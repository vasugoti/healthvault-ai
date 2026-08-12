"""
Gemini-powered OCR and metric extraction pipeline.

Pipeline stages:
  1. Read document bytes
  2. OCR + classify report type
  3. Extract structured metrics with confidence scores
  4. Normalize units
  5. Flag low-confidence values for verification
"""
import base64
import json
import logging
from typing import Optional
import google.generativeai as genai

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Configure Gemini
genai.configure(api_key=settings.gemini_api_key)


EXTRACTION_SYSTEM_PROMPT = """
You are a medical document parser. Your ONLY job is to extract structured data from lab reports and medical documents.

STRICT RULES:
1. Extract ONLY values that are explicitly printed in the document. Never infer or estimate.
2. For each metric, assign a confidence_score (0.0–1.0): 
   - 1.0: clearly printed, unambiguous value and unit
   - 0.7–0.9: value is clear but unit is implicit or abbreviation needs interpretation
   - 0.4–0.6: value is partially obscured, handwritten, or unit is unclear
   - below 0.4: very uncertain, flag for user verification
3. Extract the report_date if visible. Use ISO 8601 format (YYYY-MM-DD).
4. Detect the document_type from this list: blood, lipid, thyroid, diabetes, kidney, liver, vitamin, urine, hormonal, heart, prescription, imaging, other
5. Return ONLY valid JSON. No explanation, no markdown fences.

JSON Schema:
{
  "document_type": "string",
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "string or null",
  "doctor_name": "string or null",
  "page_count": number,
  "metrics": [
    {
      "metric_name": "string",        // e.g. "HbA1c", "Fasting Glucose", "LDL Cholesterol"
      "metric_category": "string",    // e.g. "blood", "lipid", "thyroid"
      "raw_value": "string",          // exactly as printed
      "raw_unit": "string",           // exactly as printed
      "reference_range": "string or null",  // e.g. "< 5.7%" or "70–100 mg/dL"
      "source_page": number,          // 1-indexed
      "source_location": "string",    // e.g. "Table row 3, column 2"
      "confidence_score": number      // 0.0–1.0
    }
  ]
}
"""


async def extract_from_document(
    file_bytes: bytes,
    mime_type: str,
    filename: str,
) -> dict:
    """
    Send a document to Gemini for OCR + structured metric extraction.
    Returns raw extraction result dict.
    """
    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        system_instruction=EXTRACTION_SYSTEM_PROMPT,
    )

    # Encode file as base64 for Gemini inline data
    encoded = base64.b64encode(file_bytes).decode("utf-8")

    prompt = f"""
Extract all health metrics from this medical document: {filename}
Return ONLY valid JSON matching the specified schema. Do not include markdown code fences.
"""

    try:
        response = model.generate_content(
            [
                {"inline_data": {"mime_type": mime_type, "data": encoded}},
                prompt,
            ],
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        raw_text = response.text.strip()
        # Strip markdown fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        result = json.loads(raw_text)
        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error from Gemini response: {e}")
        raise ValueError(f"Gemini returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"Gemini extraction failed: {e}")
        raise


def normalize_metric(raw_value: str, raw_unit: str, metric_name: str) -> tuple[float, str]:
    """
    Attempt to parse the raw value as float and normalize common unit variants.
    Returns (normalized_value, normalized_unit).
    """
    UNIT_NORMALIZATIONS = {
        "mg/dl": "mg/dL",
        "mg/dL": "mg/dL",
        "mmol/l": "mmol/L",
        "mmol/L": "mmol/L",
        "g/dl": "g/dL",
        "g/dL": "g/dL",
        "u/l": "U/L",
        "u/L": "U/L",
        "iu/l": "IU/L",
        "miu/ml": "mIU/mL",
        "µiu/ml": "µIU/mL",
        "%": "%",
        "seconds": "sec",
        "sec": "sec",
        "fl": "fL",
        "pg": "pg",
        "10^3/µl": "10³/µL",
        "10^6/µl": "10⁶/µL",
        "meq/l": "mEq/L",
    }

    # Parse numeric value — handle ranges like "< 5.7" by taking the number
    import re
    numeric_match = re.search(r"[\d.]+", raw_value.replace(",", "."))
    if not numeric_match:
        raise ValueError(f"Cannot parse numeric value from: {raw_value!r}")

    value = float(numeric_match.group())
    unit = UNIT_NORMALIZATIONS.get(raw_unit.strip(), raw_unit.strip())

    return value, unit


def parse_reference_range(ref_range: Optional[str]) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """
    Parse a reference range string into (low, high, unit).
    Examples: "70–100 mg/dL", "< 5.7%", "> 60 mL/min", "0.9–1.7 ng/mL"
    """
    if not ref_range:
        return None, None, None

    import re

    # Match "number–number unit"
    range_match = re.search(r"([\d.]+)\s*[-–—]\s*([\d.]+)\s*(.*)", ref_range)
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(2))
        unit = range_match.group(3).strip() or None
        return low, high, unit

    # Match "< number unit"
    lt_match = re.search(r"<\s*([\d.]+)\s*(.*)", ref_range)
    if lt_match:
        return None, float(lt_match.group(1)), lt_match.group(2).strip() or None

    # Match "> number unit"
    gt_match = re.search(r">\s*([\d.]+)\s*(.*)", ref_range)
    if gt_match:
        return float(gt_match.group(1)), None, gt_match.group(2).strip() or None

    return None, None, None

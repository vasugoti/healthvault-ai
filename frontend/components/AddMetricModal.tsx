"use client";
import { useState, useEffect } from "react";
import { metricsApi } from "@/lib/api";
import { getMetricZoneInfo } from "@/lib/healthRanges";
import { Plus, Calendar, X, Edit2, HeartPulse } from "lucide-react";

interface AddMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editMetric?: {
    id: string;
    metric_name: string;
    metric_category: string;
    value: number;
    unit: string;
    measured_at: string | null;
    reference_range_low?: number | null;
    reference_range_high?: number | null;
    notes?: string | null;
  } | null;
  presetMetric?: {
    metric_name: string;
    metric_category?: string;
    unit?: string;
  } | null;
}

const COMMON_METRICS = [
  { name: "Fasting Blood Glucose", category: "diabetes", unit: "mg/dL" },
  { name: "Post Prandial Glucose", category: "diabetes", unit: "mg/dL" },
  { name: "HbA1c", category: "diabetes", unit: "%" },
  { name: "Systolic Blood Pressure", category: "vital", unit: "mmHg" },
  { name: "Diastolic Blood Pressure", category: "vital", unit: "mmHg" },
  { name: "Heart Rate", category: "vital", unit: "bpm" },
  { name: "Body Weight", category: "vital", unit: "kg" },
  { name: "Total Cholesterol", category: "lipid", unit: "mg/dL" },
  { name: "LDL Cholesterol", category: "lipid", unit: "mg/dL" },
  { name: "HDL Cholesterol", category: "lipid", unit: "mg/dL" },
  { name: "Triglycerides", category: "lipid", unit: "mg/dL" },
  { name: "TSH", category: "thyroid", unit: "uIU/mL" },
  { name: "Vitamin D", category: "vitamin", unit: "ng/mL" },
  { name: "Vitamin B12", category: "vitamin", unit: "pg/mL" },
  { name: "Hemoglobin", category: "blood", unit: "g/dL" },
];

export default function AddMetricModal({ isOpen, onClose, onSuccess, editMetric, presetMetric }: AddMetricModalProps) {
  const [metricName, setMetricName] = useState("");
  const [metricCategory, setMetricCategory] = useState("vital");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("mg/dL");
  const [measuredDate, setMeasuredDate] = useState("");
  const [refLow, setRefLow] = useState("");
  const [refHigh, setRefHigh] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editMetric) {
      setMetricName(editMetric.metric_name);
      setMetricCategory(editMetric.metric_category || "vital");
      setValue(String(editMetric.value));
      setUnit(editMetric.unit || "");
      if (editMetric.measured_at) {
        const d = new Date(editMetric.measured_at);
        const iso = d.toISOString().slice(0, 16);
        setMeasuredDate(iso);
      } else {
        setMeasuredDate(new Date().toISOString().slice(0, 16));
      }
      setRefLow(editMetric.reference_range_low ? String(editMetric.reference_range_low) : "");
      setRefHigh(editMetric.reference_range_high ? String(editMetric.reference_range_high) : "");
      setNotes(editMetric.notes || "");
    } else if (presetMetric) {
      setMetricName(presetMetric.metric_name);
      setMetricCategory(presetMetric.metric_category || "vital");
      setValue("");
      setUnit(presetMetric.unit || "mg/dL");
      setMeasuredDate(new Date().toISOString().slice(0, 16));
      setRefLow("");
      setRefHigh("");
      setNotes("");
    } else {
      setMetricName("");
      setMetricCategory("vital");
      setValue("");
      setUnit("mg/dL");
      setMeasuredDate(new Date().toISOString().slice(0, 16));
      setRefLow("");
      setRefHigh("");
      setNotes("");
    }
    setError("");
  }, [isOpen, editMetric?.id, editMetric?.value, editMetric?.measured_at, presetMetric?.metric_name]);

  if (!isOpen) return null;

  const handleSelectQuickMetric = (item: typeof COMMON_METRICS[0]) => {
    setMetricName(item.name);
    setMetricCategory(item.category);
    setUnit(item.unit);
  };

  const handleSetToday = () => {
    const now = new Date();
    setMeasuredDate(now.toISOString().slice(0, 16));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricName.trim()) {
      setError("Please enter a metric name.");
      return;
    }
    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      setError("Please enter a valid numeric value.");
      return;
    }

    // Validate measured date is not in the future (using local IST date threshold)
    if (measuredDate) {
      const selected = new Date(measuredDate);
      const now = new Date();
      if (selected > now && selected.toDateString() !== now.toDateString()) {
        setError("Health measurement date cannot be in the future.");
        return;
      }
    }

    // Validate reference range
    if (refLow && refHigh) {
      const lowVal = parseFloat(refLow);
      const highVal = parseFloat(refHigh);
      if (!isNaN(lowVal) && !isNaN(highVal) && lowVal > highVal) {
        setError("Reference range low value cannot be greater than high value.");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      if (editMetric) {
        await metricsApi.update(editMetric.id, {
          metric_name: metricName.trim(),
          metric_category: metricCategory,
          value: numVal,
          unit: unit.trim(),
          measured_at: measuredDate ? new Date(measuredDate).toISOString() : undefined,
          reference_range_low: refLow ? parseFloat(refLow) : undefined,
          reference_range_high: refHigh ? parseFloat(refHigh) : undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await metricsApi.createManual({
          metric_name: metricName.trim(),
          metric_category: metricCategory,
          value: numVal,
          unit: unit.trim(),
          measured_at: measuredDate ? new Date(measuredDate).toISOString() : new Date().toISOString(),
          reference_range_low: refLow ? parseFloat(refLow) : undefined,
          reference_range_high: refHigh ? parseFloat(refHigh) : undefined,
          notes: notes.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save metric entry.");
    } finally {
      setLoading(false);
    }
  };

  const isPreset = Boolean(presetMetric) && !editMetric;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div className="card" style={{
        width: "100%", maxWidth: "540px", backgroundColor: "#ffffff",
        borderRadius: "16px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        overflow: "hidden", border: "1px solid var(--border-color)",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--color-neutral-50)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: "var(--color-brand-100)", color: "var(--color-brand-600)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {editMetric ? <Edit2 size={18} /> : <Plus size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                {editMetric
                  ? "Edit Health Entry"
                  : isPreset
                  ? `Add Reading for ${presetMetric?.metric_name}`
                  : "Add Health Record"}
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0 }}>
                {editMetric
                  ? "Modify value or change recorded date"
                  : isPreset
                  ? `Log a new past or live reading for ${presetMetric?.metric_name}`
                  : "Manually log a past lab test or live measurement"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "0.35rem" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {error && (
            <div style={{
              padding: "0.75rem", borderRadius: "8px", backgroundColor: "#fef2f2",
              border: "1px solid #fecaca", color: "#991b1b", fontSize: "0.85rem",
              marginBottom: "1rem",
            }}>
              {error}
            </div>
          )}

          {/* Quick Selector chips for new entries when no preset */}
          {!editMetric && !isPreset && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                Quick Presets
              </label>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", maxHeight: "80px", overflowY: "auto" }}>
                {COMMON_METRICS.slice(0, 8).map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectQuickMetric(item)}
                    style={{
                      fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "20px",
                      border: metricName === item.name ? "1px solid var(--color-brand-500)" : "1px solid var(--border-color)",
                      background: metricName === item.name ? "var(--color-brand-50)" : "#fff",
                      color: metricName === item.name ? "var(--color-brand-700)" : "var(--text-secondary)",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preset metric banner */}
          {isPreset && (
            <div style={{
              padding: "0.6rem 0.85rem", borderRadius: "8px", background: "var(--color-brand-50)",
              border: "1px solid var(--color-brand-200)", color: "var(--color-brand-800)",
              fontSize: "0.825rem", fontWeight: 600, marginBottom: "1rem",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>Recording: <strong>{metricName}</strong></span>
              <span style={{ fontSize: "0.75rem", background: "var(--color-brand-100)", padding: "0.15rem 0.5rem", borderRadius: "12px", textTransform: "capitalize" }}>
                {metricCategory}
              </span>
            </div>
          )}

          {/* Metric Name & Category (hidden or pre-filled if preset) */}
          {!isPreset && (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                  Metric Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Fasting Glucose"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                  Category
                </label>
                <select
                  className="input"
                  value={metricCategory}
                  onChange={(e) => setMetricCategory(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="vital">Vital</option>
                  <option value="blood">Blood</option>
                  <option value="diabetes">Diabetes</option>
                  <option value="lipid">Lipid</option>
                  <option value="thyroid">Thyroid</option>
                  <option value="kidney">Kidney</option>
                  <option value="liver">Liver</option>
                  <option value="vitamin">Vitamin</option>
                  <option value="urine">Urine</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Value & Unit */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Measured Value *
              </label>
              <input
                type="number"
                step="any"
                className="input"
                placeholder="e.g. 96.0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                autoFocus
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Unit *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. mg/dL, kg, bpm"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Live Clinical Range Evaluation Preview */}
          {(() => {
            const parsedVal = parseFloat(value);
            if (isNaN(parsedVal) || !metricName.trim()) return null;
            const liveZone = getMetricZoneInfo(metricName, parsedVal, unit, refLow ? parseFloat(refLow) : null, refHigh ? parseFloat(refHigh) : null);
            return (
              <div style={{
                padding: "0.55rem 0.85rem", borderRadius: "10px",
                backgroundColor: liveZone.bgColor, border: `1px solid ${liveZone.borderColor}`,
                color: liveZone.textColor, fontSize: "0.8rem", marginBottom: "1rem",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <HeartPulse size={15} style={{ color: liveZone.textColor }} />
                  <span>Live Range Check: <strong>{liveZone.label}</strong> ({liveZone.rangeText})</span>
                </div>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "10px",
                  backgroundColor: liveZone.badgeColor, color: "#fff"
                }}>
                  {liveZone.zone.toUpperCase()}
                </span>
              </div>
            );
          })()}

          {/* Recorded Date / Live vs Past */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Calendar size={14} color="var(--color-brand-600)" /> Date & Time Measured *
              </label>
              <button
                type="button"
                onClick={handleSetToday}
                style={{
                  fontSize: "0.75rem", background: "none", border: "none", color: "var(--color-brand-600)",
                  cursor: "pointer", textDecoration: "underline", fontWeight: 500,
                }}
              >
                ⚡ Set Live (Now)
              </button>
            </div>
            <input
              type="datetime-local"
              className="input"
              value={measuredDate}
              onChange={(e) => setMeasuredDate(e.target.value)}
              required
              style={{ width: "100%" }}
            />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
              Choose a past date for historical lab records, or leave as current time for live readings.
            </span>
          </div>

          {/* Reference Range (Optional) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                Ref Range Low (Optional)
              </label>
              <input
                type="number"
                step="any"
                className="input"
                placeholder="e.g. 70"
                value={refLow}
                onChange={(e) => setRefLow(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                Ref Range High (Optional)
              </label>
              <input
                type="number"
                step="any"
                className="input"
                placeholder="e.g. 110"
                value={refHigh}
                onChange={(e) => setRefHigh(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Notes (Optional)
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Measured at home digital meter / Fasting"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Footer buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : editMetric ? "Save Changes" : "Add Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

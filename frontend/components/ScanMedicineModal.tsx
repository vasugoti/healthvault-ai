"use client";
import React, { useState, useRef } from "react";
import { medicationsApi } from "@/lib/api";
import {
  Camera,
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Info,
  ShieldCheck,
  PackageCheck,
  Building2,
  FlaskConical,
} from "lucide-react";

interface ScanMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ClassifiedData {
  name: string;
  generic_name?: string | null;
  manufacturer?: string | null;
  category: string;
  dosage: string;
  frequency: string;
  prescribing_doctor?: string | null;
  packaging_info?: string | null;
  notes?: string | null;
  confidence_score?: number;
}

export default function ScanMedicineModal({
  isOpen,
  onClose,
  onSuccess,
}: ScanMedicineModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracted/editable fields for confirmation
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("other");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once Daily");
  const [doctor, setDoctor] = useState("");
  const [packagingInfo, setPackagingInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [confidenceScore, setConfidenceScore] = useState(0.9);

  if (!isOpen) return null;

  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setIsScanning(false);
    setStep("upload");
    setError("");
    setName("");
    setGenericName("");
    setManufacturer("");
    setCategory("other");
    setDosage("");
    setFrequency("Once Daily");
    setDoctor("");
    setPackagingInfo("");
    setNotes("");
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }
    setError("");
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    processImage(file);
  };

  const processImage = async (file: File) => {
    setIsScanning(true);
    setError("");
    try {
      const res = await medicationsApi.classifyImage(file);
      const data: ClassifiedData = res.data;

      setName(data.name || "");
      setGenericName(data.generic_name || "");
      setManufacturer(data.manufacturer || "");
      setCategory(data.category || "other");
      setDosage(data.dosage || "");
      setFrequency(data.frequency || "Once Daily");
      setDoctor(data.prescribing_doctor || "");
      setPackagingInfo(data.packaging_info || "");
      setNotes(data.notes || "");
      setConfidenceScore(data.confidence_score || 0.95);

      setStep("review");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const errorMsg = Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ")
        : typeof detail === "string"
        ? detail
        : "Failed to process medicine image. Please try again or fill manually.";
      setError(errorMsg);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Medicine name is required.");
      return;
    }
    if (!dosage.trim()) {
      setError("Dosage (e.g., 500mg) is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await medicationsApi.create({
        name: name.trim(),
        generic_name: genericName.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        category,
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        status: "active",
        started_at: new Date().toISOString(),
        prescribing_doctor: doctor.trim() || undefined,
        packaging_info: packagingInfo.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save medication.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(5px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: step === "review" ? "880px" : "560px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 15px rgba(16, 185, 129, 0.1)",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              "linear-gradient(135deg, var(--color-brand-50), #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(16, 185, 129, 0.25)",
              }}
            >
              <Camera size={22} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                Scan Medicine Packet <Sparkles size={16} color="#10b981" />
              </h3>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                {step === "upload"
                  ? "Upload a photo of your medicine box, strip, or bottle to extract exact refill details."
                  : "Review & confirm AI-extracted medicine packet information before saving."}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: "0.4rem" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                padding: "0.85rem",
                borderRadius: "10px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD & PROCESSING */}
          {step === "upload" && (
            <div>
              {isScanning ? (
                <div
                  style={{
                    padding: "3.5rem 2rem",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      border: "4px solid var(--color-brand-100)",
                      borderTopColor: "var(--color-brand-600)",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <div>
                    <h4
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        margin: "0 0 0.4rem 0",
                        color: "var(--text-primary)",
                      }}
                    >
                      AI Vision Analyzing Medicine Packaging...
                    </h4>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        margin: 0,
                        maxWidth: "400px",
                      }}
                    >
                      Extracting brand name, active chemical formula,
                      manufacturer, strength, dosage form, and packaging details...
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileChange(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed var(--color-brand-300)",
                      borderRadius: "16px",
                      padding: "2.75rem 2rem",
                      textAlign: "center",
                      backgroundColor: "var(--color-brand-50)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.85rem",
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                    />
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "16px",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-brand-600)",
                      }}
                    >
                      <UploadCloud size={30} />
                    </div>
                    <div>
                      <h4
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          margin: "0 0 0.3rem 0",
                          color: "var(--text-primary)",
                        }}
                      >
                        Upload or Drag & Drop Medicine Packet Image
                      </h4>
                      <p
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                          margin: 0,
                        }}
                      >
                        Supports medicine boxes, blister strips, bottles, or lab tags (PNG, JPG, WEBP)
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: "0.5rem" }}
                    >
                      Choose Photo / File
                    </button>
                  </div>

                  {/* Guidance Box */}
                  <div
                    style={{
                      marginTop: "1.25rem",
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid var(--border-color)",
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      display: "flex",
                      gap: "0.75rem",
                    }}
                  >
                    <Info size={20} color="var(--color-brand-600)" style={{ flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: "var(--text-primary)" }}>
                        Tips for accurate extraction:
                      </strong>
                      <ul style={{ margin: "0.3rem 0 0 1.2rem", padding: 0 }}>
                        <li>Ensure medicine brand name & composition text are clear & readable.</li>
                        <li>Photograph the front label or composition details on the box or strip.</li>
                        <li>You will be asked to confirm and edit all details before saving.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CONFIRMATION & REVIEW */}
          {step === "review" && (
            <form onSubmit={handleConfirmSave}>
              {/* AI Confidence Notice */}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#065f46",
                  fontSize: "0.82rem",
                  marginBottom: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <ShieldCheck size={18} color="#10b981" />
                  <span>
                    <strong>AI Classification Complete</strong> — Please review and confirm the details below.
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    backgroundColor: "#d1fae5",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "10px",
                  }}
                >
                  {(confidenceScore * 100).toFixed(0)}% Confidence
                </span>
              </div>

              {/* Two Column Layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.5fr",
                  gap: "1.5rem",
                }}
              >
                {/* Image Preview Side */}
                <div>
                  <div
                    style={{
                      position: "relative",
                      borderRadius: "14px",
                      overflow: "hidden",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "#000000",
                      maxHeight: "340px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Medicine packet scan"
                        style={{
                          width: "100%",
                          height: "100%",
                          maxHeight: "340px",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <div style={{ padding: "2rem", color: "#ffffff" }}>
                        No Image Preview
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: "100%",
                      marginTop: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <RefreshCw size={14} /> Scan Different Image
                  </button>
                </div>

                {/* Editable Fields Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  {/* Medicine Brand Name */}
                  <div>
                    <label
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        display: "block",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Brand / Medicine Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Augmentin 625 Duo, Metformin 500"
                      required
                      style={{ width: "100%", fontWeight: 600 }}
                    />
                  </div>

                  {/* Generic Composition */}
                  <div>
                    <label
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        marginBottom: "0.3rem",
                      }}
                    >
                      <FlaskConical size={14} color="var(--color-brand-600)" />
                      Active Chemical Composition / Formula
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={genericName}
                      onChange={(e) => setGenericName(e.target.value)}
                      placeholder="e.g. Amoxicillin 500mg + Potassium Clavulanate 125mg"
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Manufacturer & Category */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          marginBottom: "0.3rem",
                        }}
                      >
                        <Building2 size={13} />
                        Manufacturer / Pharma
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={manufacturer}
                        onChange={(e) => setManufacturer(e.target.value)}
                        placeholder="e.g. GlaxoSmithKline"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          display: "block",
                          marginBottom: "0.3rem",
                        }}
                      >
                        Condition Category
                      </label>
                      <select
                        className="input"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="diabetes">Diabetes</option>
                        <option value="lipid">Cholesterol</option>
                        <option value="vital">Blood Pressure</option>
                        <option value="thyroid">Thyroid</option>
                        <option value="vitamin">Vitamin</option>
                        <option value="kidney">Kidney</option>
                        <option value="other">Other / Antibiotic</option>
                      </select>
                    </div>
                  </div>

                  {/* Dosage & Frequency */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          display: "block",
                          marginBottom: "0.3rem",
                        }}
                      >
                        Dosage / Form *
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        placeholder="e.g. 625 mg Tablet"
                        required
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          display: "block",
                          marginBottom: "0.3rem",
                        }}
                      >
                        Frequency / Schedule
                      </label>
                      <select
                        className="input"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="Once Daily">Once Daily (Morning)</option>
                        <option value="Once Daily (Night)">Once Daily (At Bedtime)</option>
                        <option value="Twice Daily (After Meals)">Twice Daily (After Meals)</option>
                        <option value="Three Times Daily">Three Times Daily</option>
                        <option value="Once Weekly">Once Weekly</option>
                        <option value="As Needed (PRN)">As Needed</option>
                      </select>
                    </div>
                  </div>

                  {/* Packaging Info & Prescribing Doctor */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          marginBottom: "0.3rem",
                        }}
                      >
                        <PackageCheck size={13} />
                        Packaging Details
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={packagingInfo}
                        onChange={(e) => setPackagingInfo(e.target.value)}
                        placeholder="e.g. Strip of 10 Tablets"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          display: "block",
                          marginBottom: "0.3rem",
                        }}
                      >
                        Doctor / Clinic
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={doctor}
                        onChange={(e) => setDoctor(e.target.value)}
                        placeholder="e.g. Dr. A. Sharma"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  {/* Special Instructions & Notes */}
                  <div>
                    <label
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        display: "block",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Instructions & Precautions
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Take with water after meal. Store below 25°C."
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  borderTop: "1px solid var(--border-color)",
                  paddingTop: "1.25rem",
                  marginTop: "1.25rem",
                }}
              >
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel / Re-scan
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: "#10b981",
                    borderColor: "#059669",
                  }}
                >
                  <CheckCircle2 size={18} />
                  {isSubmitting ? "Saving Medication..." : "Confirm & Save Medication"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

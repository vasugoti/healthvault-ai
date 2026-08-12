"use client";
import { useState, useEffect } from "react";
import { medicationsApi } from "@/lib/api";
import { Pill, Calendar, X, Edit2, Plus, UserCheck, Camera, Sparkles } from "lucide-react";

interface MedicationItem {
  id: string;
  name: string;
  category: string;
  dosage: string;
  frequency: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  prescribing_doctor: string | null;
  generic_name?: string | null;
  manufacturer?: string | null;
  packaging_info?: string | null;
  notes: string | null;
}

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editMedication?: MedicationItem | null;
  onOpenScan?: () => void;
}

const COMMON_MEDICATIONS = [
  { name: "Metformin", category: "diabetes", dosage: "500 mg", frequency: "Twice Daily (After Meals)", generic_name: "Metformin Hydrochloride" },
  { name: "Glimepiride", category: "diabetes", dosage: "1 mg", frequency: "Once Daily (Before Breakfast)", generic_name: "Glimepiride" },
  { name: "Januvia (Sitagliptin)", category: "diabetes", dosage: "100 mg", frequency: "Once Daily", generic_name: "Sitagliptin Phosphate" },
  { name: "Atorvastatin", category: "lipid", dosage: "10 mg", frequency: "Once Daily (At Bedtime)", generic_name: "Atorvastatin Calcium" },
  { name: "Rosuvastatin", category: "lipid", dosage: "10 mg", frequency: "Once Daily", generic_name: "Rosuvastatin Calcium" },
  { name: "Amlodipine", category: "vital", dosage: "5 mg", frequency: "Once Daily (Morning)", generic_name: "Amlodipine Besylate" },
  { name: "Telmisartan", category: "vital", dosage: "40 mg", frequency: "Once Daily", generic_name: "Telmisartan" },
  { name: "Levothyroxine", category: "thyroid", dosage: "50 mcg", frequency: "Once Daily (Empty Stomach)", generic_name: "Levothyroxine Sodium" },
  { name: "Vitamin D3", category: "vitamin", dosage: "60,000 IU", frequency: "Once Weekly", generic_name: "Cholecalciferol" },
  { name: "Vitamin B12", category: "vitamin", dosage: "1,500 mcg", frequency: "Once Daily", generic_name: "Methylcobalamin" },
];

export default function AddMedicationModal({
  isOpen,
  onClose,
  onSuccess,
  editMedication,
  onOpenScan,
}: AddMedicationModalProps) {
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [packagingInfo, setPackagingInfo] = useState("");
  const [category, setCategory] = useState("diabetes");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once Daily");
  const [status, setStatus] = useState("active");
  const [startedDate, setStartedDate] = useState("");
  const [doctor, setDoctor] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editMedication) {
      setName(editMedication.name);
      setGenericName(editMedication.generic_name || "");
      setManufacturer(editMedication.manufacturer || "");
      setPackagingInfo(editMedication.packaging_info || "");
      setCategory(editMedication.category || "other");
      setDosage(editMedication.dosage);
      setFrequency(editMedication.frequency || "Once Daily");
      setStatus(editMedication.status || "active");
      if (editMedication.started_at) {
        setStartedDate(editMedication.started_at.slice(0, 10));
      } else {
        setStartedDate(new Date().toISOString().slice(0, 10));
      }
      setDoctor(editMedication.prescribing_doctor || "");
      setNotes(editMedication.notes || "");
    } else {
      setName("");
      setGenericName("");
      setManufacturer("");
      setPackagingInfo("");
      setCategory("diabetes");
      setDosage("");
      setFrequency("Once Daily");
      setStatus("active");
      setStartedDate(new Date().toISOString().slice(0, 10));
      setDoctor("");
      setNotes("");
    }
    setError("");
  }, [editMedication, isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (item: typeof COMMON_MEDICATIONS[0]) => {
    setName(item.name);
    setGenericName(item.generic_name || "");
    setCategory(item.category);
    setDosage(item.dosage);
    setFrequency(item.frequency);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter medicine name.");
      return;
    }
    if (!dosage.trim()) {
      setError("Please enter dosage (e.g. 500 mg).");
      return;
    }

    if (startedDate) {
      const selected = new Date(startedDate);
      const now = new Date();
      if (selected > now && selected.toDateString() !== now.toDateString()) {
        setError("Medication start date cannot be in the future.");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      if (editMedication) {
        await medicationsApi.update(editMedication.id, {
          name: name.trim(),
          generic_name: genericName.trim() || undefined,
          manufacturer: manufacturer.trim() || undefined,
          packaging_info: packagingInfo.trim() || undefined,
          category,
          dosage: dosage.trim(),
          frequency: frequency.trim(),
          status,
          started_at: startedDate ? new Date(startedDate).toISOString() : undefined,
          prescribing_doctor: doctor.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await medicationsApi.create({
          name: name.trim(),
          generic_name: genericName.trim() || undefined,
          manufacturer: manufacturer.trim() || undefined,
          packaging_info: packagingInfo.trim() || undefined,
          category,
          dosage: dosage.trim(),
          frequency: frequency.trim(),
          status,
          started_at: startedDate ? new Date(startedDate).toISOString() : new Date().toISOString(),
          prescribing_doctor: doctor.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save medication entry.");
    } finally {
      setLoading(false);
    }
  };

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
              {editMedication ? <Edit2 size={18} /> : <Pill size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                {editMedication ? "Edit Medication" : "Add Medication"}
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0 }}>
                {editMedication ? "Update medicine details or schedule" : "Log a prescription or supplement by condition"}
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

          {/* AI Scan Banner */}
          {!editMedication && onOpenScan && (
            <div style={{
              padding: "0.85rem 1rem", borderRadius: "12px",
              background: "linear-gradient(135deg, #ecfdf5, #e0f2fe)",
              border: "1px solid #a7f3d0", marginBottom: "1.25rem",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Camera size={20} color="#059669" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#065f46", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    Have a medicine box or strip? <Sparkles size={14} color="#10b981" />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#047857" }}>
                    Scan image to auto-extract brand, formula, manufacturer & schedule
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  onClose();
                  onOpenScan();
                }}
                style={{
                  backgroundColor: "#10b981", color: "#ffffff", border: "none",
                  fontSize: "0.78rem", fontWeight: 600, padding: "0.35rem 0.75rem", borderRadius: "8px"
                }}
              >
                Scan Image
              </button>
            </div>
          )}

          {/* Quick Presets */}
          {!editMedication && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>
                Quick Presets
              </label>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", maxHeight: "80px", overflowY: "auto" }}>
                {COMMON_MEDICATIONS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectPreset(item)}
                    style={{
                      fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "20px",
                      border: name === item.name ? "1px solid var(--color-brand-500)" : "1px solid var(--border-color)",
                      background: name === item.name ? "var(--color-brand-50)" : "#fff",
                      color: name === item.name ? "var(--color-brand-700)" : "var(--text-secondary)",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    + {item.name} ({item.dosage})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name & Category */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Medicine Name *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Metformin, Atorvastatin, Augmentin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
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
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Active Chemical Composition / Generic Name */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
              Active Chemical Formula / Generic Name (Optional)
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Amoxicillin 500mg + Potassium Clavulanate 125mg"
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Manufacturer & Packaging Details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                Manufacturer / Brand
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. GlaxoSmithKline, Sun Pharma"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                Packaging / Pack Size
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Strip of 10 Tablets, 100ml Bottle"
                value={packagingInfo}
                onChange={(e) => setPackagingInfo(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Dosage & Frequency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Dosage *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 500 mg, 10 mg"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
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

          {/* Status & Start Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Status
              </label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="active">Active (Taking Currently)</option>
                <option value="discontinued">Discontinued (Stopped)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Start Date
              </label>
              <input
                type="date"
                className="input"
                value={startedDate}
                onChange={(e) => setStartedDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Prescribing Doctor */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Prescribing Doctor (Optional)
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Dr. A. Sharma (Endocrinologist)"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Notes / Instructions (Optional)
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Take with food / Do not crush"
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
              {loading ? "Saving..." : editMedication ? "Save Changes" : "Add Medication"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import AddMedicationModal from "@/components/AddMedicationModal";
import ScanMedicineModal from "@/components/ScanMedicineModal";
import { medicationsApi } from "@/lib/api";
import {
  Pill,
  Plus,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  User,
  Camera,
  Sparkles,
  FlaskConical,
  Building2,
  PackageCheck,
} from "lucide-react";
import { format } from "date-fns";

interface Medication {
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
  created_at: string;
  updated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Conditions",
  diabetes: "Diabetes",
  lipid: "Cholesterol",
  vital: "Blood Pressure",
  thyroid: "Thyroid",
  vitamin: "Vitamins",
  kidney: "Kidney",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  diabetes: { bg: "#fef3c7", border: "#fde68a", text: "#92400e" },
  lipid: { bg: "#f3e8ff", border: "#e9d5ff", text: "#6b21a8" },
  vital: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  thyroid: { bg: "#e0f2fe", border: "#bae6fd", text: "#075985" },
  vitamin: { bg: "#f7fee7", border: "#d9f99d", text: "#365314" },
  kidney: { bg: "#ffe4e6", border: "#fecdd3", text: "#9f1239" },
  other: { bg: "#f1f5f9", border: "#e2e8f0", text: "#475569" },
};

export default function MedicationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadMedications = useCallback(async () => {
    try {
      const res = await medicationsApi.list({ category: activeCategory === "all" ? undefined : activeCategory });
      setMedications(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (user) loadMedications();
  }, [user, loadMedications]);

  const handleToggleStatus = async (med: Medication) => {
    const newStatus = med.status === "active" ? "discontinued" : "active";
    const actionLabel = newStatus === "discontinued" ? "discontinue" : "reactivate";
    if (!confirm(`Are you sure you want to ${actionLabel} ${med.name}?`)) return;
    try {
      await medicationsApi.update(med.id, { status: newStatus });
      loadMedications();
    } catch {
      alert("Failed to update medication status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this medication entry?")) return;
    try {
      await medicationsApi.delete(id);
      loadMedications();
    } catch {
      alert("Failed to delete medication entry");
    }
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingMedication(med);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingMedication(null);
    setIsModalOpen(true);
  };

  if (isLoading || !user) return null;

  const activeMeds = medications.filter((m) => m.status === "active");
  const discontinuedMeds = medications.filter((m) => m.status === "discontinued");

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="text-h2" style={{ marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Pill size={24} color="var(--color-brand-600)" /> Medications & Prescriptions
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
              Track daily medicines, active chemical formulas, and exact packet details for seamless refills.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn"
              onClick={() => setIsScanModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "#ecfdf5",
                color: "#047857",
                border: "1px solid #a7f3d0",
                fontWeight: 600,
              }}
            >
              <Camera size={16} color="#059669" /> Scan Medicine Packet <Sparkles size={14} color="#10b981" />
            </button>
            <button className="btn btn-primary" onClick={handleOpenNew} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Plus size={16} /> Add Medication
            </button>
          </div>
        </div>

        {/* Condition Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
          {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => {
            const isActive = activeCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setActiveCategory(catKey)}
                style={{
                  padding: "0.45rem 0.9rem", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600,
                  border: isActive ? "1px solid var(--color-brand-600)" : "1px solid var(--border-color)",
                  backgroundColor: isActive ? "var(--color-brand-50)" : "#ffffff",
                  color: isActive ? "var(--color-brand-700)" : "var(--text-secondary)",
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: "160px", borderRadius: "16px" }} />
            ))}
          </div>
        ) : medications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Pill size={28} /></div>
            <div className="empty-state-title">No medications logged</div>
            <p className="empty-state-desc">
              Scan your medicine box/strip image or manually track your active prescriptions and supplements.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1rem" }}>
              <button
                className="btn"
                onClick={() => setIsScanModalOpen(true)}
                style={{
                  backgroundColor: "#ecfdf5",
                  color: "#047857",
                  border: "1px solid #a7f3d0",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Camera size={16} /> Scan Medicine Box
              </button>
              <button className="btn btn-primary" onClick={handleOpenNew}>
                + Add Manually
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Active Medications Section */}
            {activeMeds.length > 0 && (
              <div style={{ marginBottom: "2.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981"
                  }} />
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                    Active Medications ({activeMeds.length})
                  </h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "1.25rem" }}>
                  {activeMeds.map((med) => (
                    <MedicationCard
                      key={med.id}
                      med={med}
                      onEdit={() => handleOpenEdit(med)}
                      onToggleStatus={() => handleToggleStatus(med)}
                      onDelete={() => handleDelete(med.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Discontinued Medications Section */}
            {discontinuedMeds.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#94a3b8"
                  }} />
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--text-secondary)" }}>
                    Discontinued / Past Medications ({discontinuedMeds.length})
                  </h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "1.25rem" }}>
                  {discontinuedMeds.map((med) => (
                    <MedicationCard
                      key={med.id}
                      med={med}
                      onEdit={() => handleOpenEdit(med)}
                      onToggleStatus={() => handleToggleStatus(med)}
                      onDelete={() => handleDelete(med.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        <AddMedicationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadMedications}
          editMedication={editingMedication}
          onOpenScan={() => setIsScanModalOpen(true)}
        />

        {/* AI Scan & Confirmation Modal */}
        <ScanMedicineModal
          isOpen={isScanModalOpen}
          onClose={() => setIsScanModalOpen(false)}
          onSuccess={loadMedications}
        />
      </div>
    </AppLayout>
  );
}

function MedicationCard({
  med,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  med: Medication;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const catStyle = CATEGORY_COLORS[med.category] || CATEGORY_COLORS.other;
  const isDiscontinued = med.status === "discontinued";

  return (
    <div className="card" style={{
      padding: "1.25rem", borderRadius: "14px",
      borderLeft: `4px solid ${isDiscontinued ? "#94a3b8" : catStyle.text}`,
      opacity: isDiscontinued ? 0.75 : 1, transition: "all 0.2s ease"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            {med.name}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.55rem", borderRadius: "12px",
              backgroundColor: catStyle.bg, border: `1px solid ${catStyle.border}`, color: catStyle.text,
              textTransform: "capitalize"
            }}>
              {med.category}
            </span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              {med.dosage}
            </span>
          </div>
        </div>

        <button
          onClick={onToggleStatus}
          title={isDiscontinued ? "Reactivate medication" : "Mark as discontinued"}
          style={{
            fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "12px",
            backgroundColor: isDiscontinued ? "#f1f5f9" : "#ecfdf5",
            color: isDiscontinued ? "#64748b" : "#065f46",
            border: `1px solid ${isDiscontinued ? "#cbd5e1" : "#a7f3d0"}`,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem"
          }}
        >
          {isDiscontinued ? "Stopped" : "Active"}
        </button>
      </div>

      {/* Generic Active Composition */}
      {med.generic_name && (
        <div style={{
          fontSize: "0.76rem", color: "#0369a1", backgroundColor: "#e0f2fe",
          padding: "0.3rem 0.55rem", borderRadius: "6px", marginBottom: "0.6rem",
          display: "flex", alignItems: "center", gap: "0.35rem"
        }}>
          <FlaskConical size={12} color="#0284c7" />
          <span>Composition: <strong>{med.generic_name}</strong></span>
        </div>
      )}

      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <Clock size={13} color="var(--color-brand-600)" />
        <span>Schedule: <strong>{med.frequency}</strong></span>
      </div>

      {/* Manufacturer & Packaging Details for Refills */}
      {(med.manufacturer || med.packaging_info) && (
        <div style={{
          fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem",
          display: "flex", gap: "0.75rem", flexWrap: "wrap"
        }}>
          {med.manufacturer && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Building2 size={12} color="#64748b" /> Mfr: <strong>{med.manufacturer}</strong>
            </span>
          )}
          {med.packaging_info && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <PackageCheck size={12} color="#64748b" /> Pack: <strong>{med.packaging_info}</strong>
            </span>
          )}
        </div>
      )}

      {med.prescribing_doctor && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <User size={12} />
          <span>Doctor: {med.prescribing_doctor}</span>
        </div>
      )}

      {med.notes && (
        <div style={{
          fontSize: "0.75rem", color: "var(--text-secondary)", background: "var(--color-neutral-50)",
          padding: "0.4rem 0.6rem", borderRadius: "6px", marginBottom: "0.75rem", borderLeft: "2px solid var(--border-color)"
        }}>
          {med.notes}
        </div>
      )}

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: "1px solid var(--border-color)", paddingTop: "0.6rem", marginTop: "0.5rem"
      }}>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {med.started_at ? `Started ${format(new Date(med.started_at), "MMM d, yyyy")}` : "Date unknown"}
        </span>

        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button
            title="Edit medication"
            className="btn btn-ghost btn-sm"
            style={{ padding: "0.25rem 0.4rem" }}
            onClick={onEdit}
          >
            <Edit2 size={13} color="var(--color-brand-600)" />
          </button>
          <button
            title="Delete medication"
            className="btn btn-ghost btn-sm"
            style={{ padding: "0.25rem 0.4rem" }}
            onClick={onDelete}
          >
            <Trash2 size={13} color="#e11d48" />
          </button>
        </div>
      </div>
    </div>
  );
}


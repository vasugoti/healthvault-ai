"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { metricsApi, documentsApi } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertTriangle, Edit2, FileText, ExternalLink } from "lucide-react";

interface Metric {
  id: string; metric_name: string; value: number; unit: string;
  raw_value: string; raw_unit: string; measured_at: string | null;
  confidence_score: number; verification_status: string;
  source_page: number | null; source_location: string | null;
  document_id: string; document_filename: string | null;
}

export default function VerificationCenterPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadUnverified = useCallback(async () => {
    try {
      const res = await metricsApi.unverified();
      const all = res.data.items || [];
      // Filter to this document's metrics
      const filtered = docId === "all" ? all : all.filter((m: Metric) => m.document_id === docId);
      setMetrics(filtered);
    } catch { /* handled */ }
    setLoading(false);
  }, [docId]);

  useEffect(() => {
    if (user) loadUnverified();
  }, [user, loadUnverified]);

  const handleConfirm = async (metricId: string) => {
    setSaving(true);
    try {
      await metricsApi.verify(metricId, { action: "confirm" });
      setMetrics((prev) => prev.filter((m) => m.id !== metricId));
    } catch { alert("Failed to confirm metric"); }
    setSaving(false);
  };

  const handleEdit = async (metricId: string) => {
    setSaving(true);
    try {
      await metricsApi.verify(metricId, {
        action: "edit",
        value: parseFloat(editValue) || undefined,
        unit: editUnit || undefined,
        notes: editNotes || undefined,
      });
      setMetrics((prev) => prev.filter((m) => m.id !== metricId));
      setEditingId(null);
    } catch { alert("Failed to edit metric"); }
    setSaving(false);
  };

  const startEdit = (metric: Metric) => {
    setEditingId(metric.id);
    setEditValue(String(metric.value));
    setEditUnit(metric.unit);
    setEditNotes("");
  };

  if (isLoading || !user) return null;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
          <Link href={`/records/${docId}`}>
            <button className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> Back to report</button>
          </Link>
          <div>
            <h1 className="text-h2" style={{ marginBottom: "0.2rem" }}>Data Verification Center</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Review and confirm every AI-extracted value before it becomes part of your health record.
            </p>
          </div>
        </div>

        {/* Safety notice */}
        <div style={{
          padding: "0.875rem 1.125rem", background: "var(--color-info-bg)",
          border: "1px solid var(--color-info-border)", borderRadius: "10px",
          marginBottom: "1.75rem", fontSize: "0.8rem", color: "var(--color-info-text)", lineHeight: 1.6,
        }}>
          <strong>How verification works:</strong> Every value extracted by AI starts unverified. Compare each value against your original document before confirming. If a value looks wrong, edit it. Nothing on your dashboard or timeline is presented as fact until you confirm it.
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "12px" }} />
            ))}
          </div>
        ) : metrics.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><CheckCircle size={28} color="var(--color-verified-icon)" /></div>
            <div className="empty-state-title">All values verified</div>
            <p className="empty-state-desc">
              Every extracted value from this report has been confirmed. Your health record is up to date.
            </p>
            <Link href="/dashboard">
              <button className="btn btn-primary">Go to Dashboard</button>
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              {metrics.length} value{metrics.length !== 1 ? "s" : ""} need your review
            </div>

            {metrics.map((metric) => (
              <div key={metric.id} className="card" style={{ padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500, marginBottom: "0.25rem", textTransform: "capitalize" }}>
                      {metric.metric_name}
                    </div>

                    {editingId === metric.id ? (
                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.875rem" }}>
                        <div>
                          <label className="label">Value</label>
                          <input
                            className="input" type="number" step="any"
                            value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            style={{ width: "120px" }}
                          />
                        </div>
                        <div>
                          <label className="label">Unit</label>
                          <input
                            className="input" value={editUnit} onChange={(e) => setEditUnit(e.target.value)}
                            style={{ width: "100px" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label">Notes (optional)</label>
                          <input
                            className="input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Reason for edit..."
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span className="data-value" style={{ fontSize: "1.625rem", fontWeight: 700 }}>{metric.value}</span>
                        <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{metric.unit}</span>
                        {metric.raw_value !== String(metric.value) && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            (extracted: {metric.raw_value} {metric.raw_unit})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Provenance */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Source:</span>
                      <Link href={`/records/${metric.document_id}`} className="provenance-link" style={{ fontSize: "0.7rem" }}>
                        <FileText size={10} />
                        {metric.document_filename || "View report"}
                        {metric.source_page && ` · Page ${metric.source_page}`}
                        <ExternalLink size={9} />
                      </Link>
                    </div>

                    {metric.confidence_score < 0.7 && (
                      <div style={{
                        marginTop: "0.625rem", display: "flex", alignItems: "center", gap: "0.375rem",
                        fontSize: "0.75rem", color: "var(--color-unverified-text)",
                      }}>
                        <AlertTriangle size={12} />
                        Low confidence ({Math.round(metric.confidence_score * 100)}%) — please check against your document carefully
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
                    {editingId === metric.id ? (
                      <>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleEdit(metric.id)}
                          disabled={saving}
                        >
                          <CheckCircle size={12} /> Save edit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleConfirm(metric.id)}
                          disabled={saving}
                        >
                          <CheckCircle size={12} /> Confirm
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEdit(metric)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { documentsApi, metricsApi } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, CheckCircle, AlertTriangle, Clock, Edit2 } from "lucide-react";
import { format } from "date-fns";

interface Metric {
  id: string; metric_name: string; metric_category: string;
  value: number; unit: string; raw_value: string; raw_unit: string;
  measured_at: string | null; confidence_score: number;
  verification_status: string; source_page: number | null;
  source_location: string | null; reference_range_low: number | null;
  reference_range_high: number | null; reference_range_unit: string | null;
}
interface Document {
  id: string; original_filename: string; document_type: string | null;
  processing_status: string; report_date: string | null;
  lab_name: string | null; doctor_name: string | null;
  page_count: number | null; extracted_values_count: number;
  verified_values_count: number; created_at: string;
}

export default function RecordDetailPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !docId) return;
    Promise.all([
      documentsApi.get(docId),
      metricsApi.list({ document_id: docId }),
      documentsApi.getUrl(docId),
    ])
      .then(([docRes, metricsRes, urlRes]) => {
        setDoc(docRes.data);
        setMetrics(metricsRes.data.items || []);
        setPreviewUrl(urlRes.data.url);
      })
      .catch(() => router.replace("/records"))
      .finally(() => setLoading(false));
  }, [user, docId, router]);

  if (isLoading || !user || loading) {
    return (
      <AppLayout>
        <div style={{ padding: "2rem 2.5rem" }}>
          <div className="skeleton" style={{ height: "32px", width: "200px", marginBottom: "2rem" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "1.5rem" }}>
            <div className="skeleton" style={{ height: "600px" }} />
            <div className="skeleton" style={{ height: "600px" }} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!doc) return null;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <Link href="/records">
            <button className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> Records</button>
          </Link>
          <div style={{ flex: 1 }}>
            <h1 className="text-h2" style={{ marginBottom: "0.2rem" }}>{doc.original_filename}</h1>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {doc.document_type && <span style={{ textTransform: "capitalize" }}>{doc.document_type}</span>}
              {doc.lab_name && <span>Lab: {doc.lab_name}</span>}
              {doc.doctor_name && <span>Dr. {doc.doctor_name}</span>}
              {doc.report_date && <span>{format(new Date(doc.report_date), "MMMM d, yyyy")}</span>}
            </div>
          </div>
          <Link href={`/records/${docId}/verify`}>
            <button className="btn btn-primary btn-sm">
              Verify Values ({doc.extracted_values_count - doc.verified_values_count} pending)
            </button>
          </Link>
        </div>

        {/* Split view */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "1.5rem" }}>
          {/* Document preview */}
          <div className="card" style={{ overflow: "hidden", minHeight: "600px", display: "flex", flexDirection: "column" }}>
            <div style={{
              padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border-color)",
              display: "flex", alignItems: "center", gap: "0.5rem",
              fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)",
            }}>
              <FileText size={14} /> Document Preview
            </div>
            {previewUrl ? (
              <iframe
                src={previewUrl}
                style={{ flex: 1, border: "none", minHeight: "560px" }}
                title="Document preview"
              />
            ) : (
              <div className="empty-state" style={{ flex: 1 }}>
                <div className="empty-state-icon"><FileText size={24} /></div>
                <div className="empty-state-title">Preview not available</div>
                <p className="empty-state-desc">The document preview could not be loaded.</p>
              </div>
            )}
          </div>

          {/* Extracted values */}
          <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{
              padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border-color)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Extracted Values ({metrics.length})
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {doc.verified_values_count}/{doc.extracted_values_count} verified
              </span>
            </div>
            <div style={{ overflow: "auto", flex: 1 }}>
              {metrics.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-desc">No values extracted from this document.</p>
                </div>
              ) : (
                metrics.map((metric) => (
                  <div
                    key={metric.id}
                    onClick={() => setSelectedMetric(metric.id === selectedMetric?.id ? null : metric)}
                    style={{
                      padding: "0.875rem 1.25rem",
                      borderBottom: "1px solid var(--color-neutral-100)",
                      cursor: "pointer",
                      background: selectedMetric?.id === metric.id ? "var(--color-brand-50)" : undefined,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (selectedMetric?.id !== metric.id) e.currentTarget.style.background = "var(--color-neutral-50)"; }}
                    onMouseLeave={(e) => { if (selectedMetric?.id !== metric.id) e.currentTarget.style.background = ""; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                          {metric.metric_name}
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                          <span className="data-value" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {metric.value}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{metric.unit}</span>
                        </div>
                        {metric.reference_range_low !== null && (
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                            Ref: {metric.reference_range_low}–{metric.reference_range_high} {metric.reference_range_unit}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
                        <VerificationBadge status={metric.verification_status} />
                        {metric.confidence_score < 0.7 && (
                          <span style={{ fontSize: "0.65rem", color: "var(--color-unverified-text)" }}>
                            Low confidence — please verify
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Provenance */}
                    {metric.source_page && (
                      <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Source:</span>
                        <a href="#" className="provenance-link" style={{ fontSize: "0.65rem" }}>
                          Page {metric.source_page}
                          {metric.source_location && ` · ${metric.source_location}`}
                          <ExternalLink size={9} />
                        </a>
                      </div>
                    )}

                    {/* Actions when selected */}
                    {selectedMetric?.id === metric.id && (
                      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                        <Link href={`/records/${docId}/verify?metric=${metric.id}`}>
                          <button className="btn btn-primary btn-sm">
                            <CheckCircle size={12} /> Verify
                          </button>
                        </Link>
                        <Link href={`/metrics/${metric.id}`}>
                          <button className="btn btn-secondary btn-sm">
                            View trend →
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") return <span className="badge badge-verified"><CheckCircle size={10} />Verified</span>;
  if (status === "edited") return <span className="badge badge-info"><Edit2 size={10} />Edited</span>;
  return <span className="badge badge-unverified"><AlertTriangle size={10} />Unverified</span>;
}

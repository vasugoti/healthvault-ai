"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { documentsApi, metricsApi, remindersApi } from "@/lib/api";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus, Upload, AlertTriangle,
  FileText, CheckCircle, Clock, ArrowRight, Activity, Bell, Calendar
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { format, parseISO, isBefore } from "date-fns";

import AddMetricModal from "@/components/AddMetricModal";
import { Plus } from "lucide-react";

interface Metric {
  id: string; metric_name: string; metric_category: string;
  value: number; unit: string; measured_at: string | null;
  verification_status: string; document_id: string;
}
interface Document {
  id: string; original_filename: string; document_type: string | null;
  processing_status: string; report_date: string | null;
  extracted_values_count: number; verified_values_count: number; created_at: string;
}
interface Reminder {
  id: string; title: string; category: string; reminder_type: string;
  frequency_value: number | null; frequency_unit: string | null;
  next_due_date: string; is_active: boolean; notes: string | null;
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadDashboard = useCallback(async () => {
    try {
      const [metricsRes, unverifiedRes, docsRes, remindersRes] = await Promise.allSettled([
        metricsApi.list({ page_size: 8 }),
        metricsApi.unverified(),
        documentsApi.list({ page_size: 5 }),
        remindersApi.list({ is_active: true }),
      ]);

      if (metricsRes.status === "fulfilled") {
        setMetrics(metricsRes.value.data.items || []);
      }
      if (unverifiedRes.status === "fulfilled") {
        setUnverifiedCount(unverifiedRes.value.data.total || 0);
      }
      if (docsRes.status === "fulfilled") {
        setRecentDocs(docsRes.value.data.items || []);
      }
      if (remindersRes.status === "fulfilled") {
        const data = remindersRes.value.data;
        setReminders(Array.isArray(data) ? data : (data?.items || []));
      }
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCompleteReminder = async (id: string) => {
    try {
      await remindersApi.complete(id);
      loadDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  if (isLoading || !user) return null;

  const noData = !loading && metrics.length === 0 && recentDocs.length === 0;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="text-h1" style={{ marginBottom: "0.25rem" }}>
              Good {getGreeting()}, {user.full_name.split(" ")[0]}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(true)}>
              <Plus size={15} /> Add Record
            </button>
            <Link href="/records">
              <button className="btn btn-primary" id="dashboard-upload-cta">
                <Upload size={15} /> Upload Report
              </button>
            </Link>
          </div>
        </div>

        {/* Unverified banner */}
        {unverifiedCount > 0 && (
          <Link href="/records" style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.875rem 1.25rem",
              background: "var(--color-unverified-bg)", border: "1px solid var(--color-unverified-border)",
              borderRadius: "12px", marginBottom: "1.75rem", cursor: "pointer",
              transition: "box-shadow 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <AlertTriangle size={16} color="var(--color-unverified-icon)" />
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-unverified-text)" }}>
                  {unverifiedCount} metric{unverifiedCount > 1 ? "s" : ""} need{unverifiedCount === 1 ? "s" : ""} your verification
                </span>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--color-unverified-text)", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                Review now <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        )}

        {/* Empty state */}
        {noData && (
          <div className="card" style={{ padding: "4rem 2rem", textAlign: "center" }}>
            <div className="empty-state-icon" style={{ margin: "0 auto 1.5rem" }}>
              <Activity size={28} color="var(--text-muted)" />
            </div>
            <div className="empty-state-title">Upload your first report</div>
            <p className="empty-state-desc" style={{ margin: "0.5rem auto 2rem" }}>
              Add a lab report, blood panel, or any medical document to start building your health history.
            </p>
            <Link href="/records">
              <button className="btn btn-primary btn-lg">
                <Upload size={16} /> Upload your first report
              </button>
            </Link>
          </div>
        )}

        {/* Reminders widget */}
        {reminders.length > 0 && (
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Bell size={18} color="var(--color-brand-600)" />
                <h2 className="text-h3" style={{ margin: 0 }}>Upcoming & Overdue Test Reminders</h2>
              </div>
              <Link href="/reminders" style={{ fontSize: "0.8rem", color: "var(--color-brand-600)", fontWeight: 500 }}>
                Manage Reminders →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {reminders.slice(0, 3).map((r) => {
                const due = parseISO(r.next_due_date);
                const isOverdue = isBefore(due, new Date());
                return (
                  <div
                    key={r.id}
                    className="card"
                    style={{
                      padding: "1rem 1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      borderLeft: isOverdue ? "4px solid #ef4444" : "4px solid var(--color-brand-500)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.03em" }}>
                          {r.category.replace("_", " ")}
                        </span>
                        {isOverdue ? (
                          <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "10px", background: "#fef2f2", color: "#dc2626", fontWeight: 700 }}>
                            Overdue
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "10px", background: "#f0f9ff", color: "#0284c7", fontWeight: 600 }}>
                            Upcoming
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Calendar size={13} color="var(--text-muted)" />
                        <span>Due {format(due, "MMM d, yyyy")}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--color-neutral-100)", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleCompleteReminder(r.id)}
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.35rem 0.65rem",
                          borderRadius: "6px",
                          border: "none",
                          background: "var(--color-brand-50)",
                          color: "var(--color-brand-700)",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <CheckCircle size={13} /> Mark Done
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Metrics grid */}
        {metrics.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 className="text-h3">Tracked Metrics</h2>
              <Link href="/metrics" style={{ fontSize: "0.8rem", color: "var(--color-brand-600)", fontWeight: 500 }}>
                View all →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
              {metrics.map((m) => (
                <MetricCard key={m.id} metric={m} />
              ))}
            </div>
          </>
        )}

        {/* Recent reports */}
        {recentDocs.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 className="text-h3">Recent Reports</h2>
              <Link href="/records" style={{ fontSize: "0.8rem", color: "var(--color-brand-600)", fontWeight: 500 }}>
                View all →
              </Link>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {recentDocs.map((doc, i) => (
                <Link key={doc.id} href={`/records/${doc.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    padding: "0.875rem 1.25rem",
                    borderBottom: i < recentDocs.length - 1 ? "1px solid var(--color-neutral-100)" : "none",
                    transition: "background 0.1s", cursor: "pointer",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-neutral-50)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "8px",
                      background: "var(--color-brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <FileText size={16} color="var(--color-brand-600)" />
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.original_filename}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {doc.document_type || "Processing"} · {doc.report_date ? format(new Date(doc.report_date), "MMM d, yyyy") : format(new Date(doc.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                      <StatusBadge status={doc.processing_status} />
                      {doc.extracted_values_count > 0 && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {doc.verified_values_count}/{doc.extracted_values_count} verified
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
        {/* Modal for manual entry */}
        <AddMetricModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadDashboard}
        />
      </div>
    </AppLayout>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const [series, setSeries] = useState<{ date: string; value: number }[]>([]);

  useEffect(() => {
    metricsApi.series(metric.id).then((res) => {
      const measurements = res.data.measurements || [];
      setSeries(measurements.slice(-8).map((m: Metric) => ({
        date: m.measured_at || "",
        value: m.value,
      })));
    }).catch(() => {});
  }, [metric.id]);

  const trend = series.length >= 2
    ? series[series.length - 1].value - series[series.length - 2].value
    : 0;

  return (
    <Link href={`/metrics/${metric.id}`} style={{ textDecoration: "none" }}>
      <div className="card-metric">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              {metric.metric_name}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {metric.metric_category}
            </div>
          </div>
          {metric.verification_status === "unverified" && (
            <span className="badge badge-unverified">⚠ Unverified</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", marginBottom: "0.875rem" }}>
          <span className="data-value" style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
            {metric.value}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingBottom: "2px" }}>
            {metric.unit}
          </span>
          {series.length >= 2 && (
            <span style={{
              display: "flex", alignItems: "center", gap: "2px",
              fontSize: "0.75rem", fontWeight: 600, paddingBottom: "2px",
              color: trend > 0 ? "#10b981" : trend < 0 ? "#e11d48" : "var(--text-muted)",
            }}>
              {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {Math.abs(trend).toFixed(1)}
            </span>
          )}
        </div>

        {series.length > 1 && (
          <div style={{ height: "48px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <Line
                  type="monotone" dataKey="value" stroke="var(--color-brand-500)"
                  strokeWidth={2} dot={false} />
<Tooltip
                  contentStyle={{ fontSize: "0.75rem", padding: "4px 8px", border: "1px solid var(--border-color)" }}
                  formatter={(v) => [`${v ?? ""} ${metric.unit}`, metric.metric_name]}
                  labelFormatter={() => ""}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {metric.measured_at && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Last: {format(new Date(metric.measured_at), "MMM d, yyyy")}
          </div>
        )}
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") return (
    <span className="badge badge-verified"><CheckCircle size={10} />Ready</span>
  );
  if (status === "failed") return (
    <span className="badge badge-error"><AlertTriangle size={10} />Failed</span>
  );
  return (
    <span className="badge badge-neutral"><Clock size={10} />{status}</span>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import AddMetricModal from "@/components/AddMetricModal";
import { metricsApi } from "@/lib/api";
import { getMetricZoneInfo } from "@/lib/healthRanges";
import Link from "next/link";
import { Activity, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Metric {
  id: string; metric_name: string; metric_category: string;
  value: number; unit: string; measured_at: string | null;
  verification_status: string; document_id: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  blood: "#3390f5", lipid: "#8b5cf6", thyroid: "#10b981",
  diabetes: "#f59e0b", kidney: "#e11d48", liver: "#06b6d4",
  vitamin: "#84cc16", urine: "#f97316", hormonal: "#ec4899",
  heart: "#ef4444", vital: "#10b981", other: "#94a3b8",
};

export default function MetricsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadMetrics = useCallback(async () => {
    try {
      const [metricsRes, unverifiedRes] = await Promise.all([
        metricsApi.list({ category: activeCategory || undefined }),
        metricsApi.unverified(),
      ]);
      setMetrics(metricsRes.data.items || []);
      setUnverifiedCount(unverifiedRes.data.total || 0);
    } catch { /* handled */ }
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { if (user) loadMetrics(); }, [user, loadMetrics]);

  const categories = [...new Set(metrics.map((m) => m.metric_category))];

  if (isLoading || !user) return null;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="text-h1" style={{ marginBottom: "0.25rem" }}>Health Metrics</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""} tracked
              {unverifiedCount > 0 && (
                <span style={{ marginLeft: "0.75rem", color: "var(--color-unverified-text)", fontWeight: 500 }}>
                  · {unverifiedCount} unverified
                </span>
              )}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Plus size={16} /> Add Health Record
          </button>
        </div>

        {/* Category filter tabs */}
        {categories.length > 1 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <button
              className={`btn btn-sm ${activeCategory === null ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveCategory(null)}
            >All</button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${activeCategory === cat ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                style={{ textTransform: "capitalize" }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: CATEGORY_COLORS[cat] || "#94a3b8" }} />
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "140px", borderRadius: "16px" }} />
            ))}
          </div>
        ) : metrics.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Activity size={28} /></div>
            <div className="empty-state-title">No metrics yet</div>
            <p className="empty-state-desc">
              Upload a lab report or manually log past/live health entries to start tracking your health over time.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                + Add Manual Record
              </button>
              <Link href="/records">
                <button className="btn btn-secondary">Upload a report →</button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {metrics.map((metric) => (
              <MetricSummaryCard key={metric.id} metric={metric} />
            ))}
          </div>
        )}

        {/* Manual Record Add Modal */}
        <AddMetricModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadMetrics}
        />
      </div>
    </AppLayout>
  );
}

function MetricSummaryCard({ metric }: { metric: Metric }) {
  const zoneInfo = getMetricZoneInfo(metric.metric_name, metric.value, metric.unit);

  return (
    <Link href={`/metrics/${metric.id}`} style={{ textDecoration: "none" }}>
      <div className="card-metric" style={{ borderLeft: `4px solid ${zoneInfo.badgeColor}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.875rem" }}>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.2rem" }}>
              {metric.metric_name}
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
              {metric.metric_category}
            </span>
          </div>
          <span style={{
            fontSize: "0.65rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "12px",
            backgroundColor: zoneInfo.bgColor, color: zoneInfo.textColor, border: `1px solid ${zoneInfo.borderColor}`
          }}>
            {zoneInfo.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", marginBottom: "0.5rem" }}>
          <span className="data-value" style={{ fontSize: "1.75rem", fontWeight: 700, color: zoneInfo.textColor }}>
            {metric.value}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{metric.unit}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.725rem", color: "var(--text-muted)", borderTop: "1px solid var(--color-neutral-100)", paddingTop: "0.5rem" }}>
          <span>{metric.measured_at ? `Recorded ${format(new Date(metric.measured_at), "MMM d, yyyy")}` : "Date unknown"}</span>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--color-brand-600)" }}>View Details →</span>
        </div>
      </div>
    </Link>
  );
}

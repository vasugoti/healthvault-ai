"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import AddMetricModal from "@/components/AddMetricModal";
import { metricsApi } from "@/lib/api";
import { getMetricZoneInfo, detectSuddenChange } from "@/lib/healthRanges";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, ExternalLink, TrendingUp, TrendingDown, Plus, Edit2, Trash2, ShieldAlert, HeartPulse, Lightbulb, Info } from "lucide-react";
import { format } from "date-fns";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from "recharts";

interface Measurement {
  id: string; value: number; unit: string; measured_at: string | null;
  verification_status: string; document_id: string; document_filename: string | null;
  source_page: number | null; metric_name?: string; metric_category?: string;
  reference_range_low?: number | null; reference_range_high?: number | null; notes?: string | null;
}
interface Summary {
  count: number; first_measured_at: string | null; latest_measured_at: string | null;
  min_value: number | null; max_value: number | null;
  first_value: number | null; latest_value: number | null;
}

export default function MetricDetailPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const metricId = params.id as string;

  const [data, setData] = useState<{
    metric_name: string; metric_category: string; unit: string;
    summary: Summary; measurements: Measurement[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);

  const loadSeries = useCallback(async () => {
    try {
      const res = await metricsApi.getSeries(metricId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [metricId]);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const handleDeleteMeasurement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this measurement entry?")) return;
    try {
      await metricsApi.delete(id);
      loadSeries();
    } catch {
      alert("Failed to delete measurement");
    }
  };

  const handleOpenEdit = (m: Measurement) => {
    setEditingMeasurement({
      ...m,
      metric_name: data?.metric_name || "",
      metric_category: data?.metric_category || "vital",
    });
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingMeasurement(null);
    setIsModalOpen(true);
  };

  if (isLoading || !user || loading) {
    return (
      <AppLayout>
        <div style={{ padding: "2rem 2.5rem" }}>
          <div className="skeleton" style={{ height: "400px", borderRadius: "16px" }} />
        </div>
      </AppLayout>
    );
  }
  if (!data) return null;

  const { measurements, summary } = data;

  // Sort measurements newest first for calculation
  const sortedMeasurements = [...measurements].sort((a, b) => {
    const dA = a.measured_at ? new Date(a.measured_at).getTime() : 0;
    const dB = b.measured_at ? new Date(b.measured_at).getTime() : 0;
    return dB - dA;
  });

  const latestM = sortedMeasurements[0];
  const prevM = sortedMeasurements[1];

  const zoneInfo = getMetricZoneInfo(
    data.metric_name,
    summary.latest_value ?? 0,
    data.unit,
    latestM?.reference_range_low,
    latestM?.reference_range_high
  );

  const prevZone = prevM ? getMetricZoneInfo(data.metric_name, prevM.value, data.unit).zone : null;

  const suddenAlert = detectSuddenChange(
    summary.latest_value ?? 0,
    prevM?.value ?? null,
    prevM?.measured_at ? format(new Date(prevM.measured_at), "MMM d, yyyy") : null,
    zoneInfo.zone,
    prevZone,
    data.unit
  );

  const chartData = [...measurements]
    .sort((a, b) => {
      const dA = a.measured_at ? new Date(a.measured_at).getTime() : 0;
      const dB = b.measured_at ? new Date(b.measured_at).getTime() : 0;
      return dA - dB;
    })
    .filter((m) => m.measured_at)
    .map((m) => ({
      date: format(new Date(m.measured_at!), "MMM d, yy"),
      value: m.value,
      id: m.id,
    }));

  const change = summary.first_value !== null && summary.latest_value !== null
    ? summary.latest_value - summary.first_value : null;
  const changePct = summary.first_value ? (change! / summary.first_value) * 100 : null;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "1050px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/metrics">
              <button className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> Metrics</button>
            </Link>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <h1 className="text-h2" style={{ marginBottom: "0.2rem" }}>{data.metric_name}</h1>
                <span style={{
                  fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "12px",
                  fontWeight: 600, textTransform: "capitalize",
                  background: "var(--color-neutral-100)", color: "var(--text-secondary)"
                }}>
                  {data.metric_category}
                </span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {summary.count} measurement{summary.count !== 1 ? "s" : ""} recorded
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleOpenNew} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Plus size={16} /> Add Measurement
          </button>
        </div>

        {/* Sudden Shift / Limit Notification Alert */}
        {suddenAlert.isSuddenChange && (
          <div style={{
            padding: "1rem 1.25rem", borderRadius: "12px", marginBottom: "1.5rem",
            backgroundColor: suddenAlert.urgency === "critical" ? "#fef2f2" : "#fffbeb",
            border: `1px solid ${suddenAlert.urgency === "critical" ? "#fecaca" : "#fde68a"}`,
            color: suddenAlert.urgency === "critical" ? "#991b1b" : "#92400e",
            display: "flex", alignItems: "flex-start", gap: "0.75rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}>
            <ShieldAlert size={22} style={{ marginTop: "2px", flexShrink: 0, color: suddenAlert.urgency === "critical" ? "#dc2626" : "#d97706" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                {suddenAlert.urgency === "critical" ? "🚨 Critical Alert: Sudden Limit Shift Detected" : "⚠️ Warning: Significant Change Detected"}
              </div>
              <p style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.4 }}>
                {suddenAlert.message}
              </p>
            </div>
          </div>
        )}

        {/* Clinical Zone & Standard Guidance Box */}
        <div style={{
          padding: "1.25rem 1.5rem", borderRadius: "14px", marginBottom: "1.75rem",
          backgroundColor: zoneInfo.bgColor, border: `1px solid ${zoneInfo.borderColor}`,
          display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem", alignItems: "center",
        }}>
          {/* Zone Badge */}
          <div style={{ borderRight: "1px solid rgba(0,0,0,0.08)", paddingRight: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", color: zoneInfo.textColor, marginBottom: "0.35rem" }}>
              Current Status Zone
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{
                fontSize: "0.85rem", fontWeight: 700, padding: "0.35rem 0.85rem", borderRadius: "20px",
                backgroundColor: zoneInfo.badgeColor, color: "#ffffff", display: "inline-flex", alignItems: "center", gap: "0.35rem"
              }}>
                <HeartPulse size={14} /> {zoneInfo.label}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: zoneInfo.textColor, fontWeight: 500 }}>
              Standard Range: <strong>{zoneInfo.rangeText}</strong>
            </div>
          </div>

          {/* Clinical Action Guidance / Tips */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, fontSize: "0.85rem", color: zoneInfo.textColor, marginBottom: "0.35rem" }}>
              <Lightbulb size={16} /> Clinical Standard Guidance & Action Tips
            </div>
            <p style={{ fontSize: "0.85rem", color: zoneInfo.textColor, margin: 0, lineHeight: 1.45 }}>
              {zoneInfo.actionTip}
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.75rem" }}>
          {[
            { label: "Latest Reading", value: summary.latest_value, unit: data.unit, zone: zoneInfo },
            { label: "First Reading", value: summary.first_value, unit: data.unit },
            { label: "Lowest Recorded", value: summary.min_value, unit: data.unit },
            { label: "Highest Recorded", value: summary.max_value, unit: data.unit },
          ].map((stat, idx) => (
            <div key={stat.label} className="card" style={{ padding: "1rem 1.25rem", borderLeft: idx === 0 ? `4px solid ${zoneInfo.badgeColor}` : undefined }}>
              <div className="text-label" style={{ marginBottom: "0.5rem" }}>{stat.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
                <span className="data-value" style={{ fontSize: "1.5rem", fontWeight: 700, color: idx === 0 ? zoneInfo.textColor : undefined }}>
                  {stat.value !== null ? stat.value : "—"}
                </span>
                {stat.value !== null && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{stat.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Change indicator */}
        {change !== null && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.75rem 1.125rem", borderRadius: "10px", marginBottom: "1.75rem",
            background: "var(--color-neutral-50)", border: "1px solid var(--border-color)",
            fontSize: "0.875rem",
          }}>
            {change > 0 ? <TrendingUp size={16} color="#10b981" /> : <TrendingDown size={16} color="#e11d48" />}
            <span>
              Your recorded <strong>{data.metric_name}</strong> has{" "}
              {change > 0 ? "increased" : "decreased"} by{" "}
              <strong>{Math.abs(change).toFixed(2)} {data.unit}</strong>
              {changePct !== null && ` (${Math.abs(changePct).toFixed(1)}%)`}{" "}
              across your recorded readings from{" "}
              {summary.first_measured_at ? format(new Date(summary.first_measured_at), "MMM yyyy") : "first"} to{" "}
              {summary.latest_measured_at ? format(new Date(summary.latest_measured_at), "MMM yyyy") : "latest"}.
            </span>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div className="text-label">Trend over time</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Info size={13} /> Target Safe Range: {zoneInfo.rangeText}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={zoneInfo.badgeColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={zoneInfo.badgeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-100)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{
                        background: "#fff", border: "1px solid var(--border-color)",
                        borderRadius: "8px", padding: "0.5rem 0.75rem",
                        boxShadow: "var(--shadow-md)", fontSize: "0.8rem",
                      }}>
                        <div style={{ fontWeight: 600 }}>{d.date}</div>
                        <div style={{ color: zoneInfo.badgeColor, fontWeight: 700 }}>
                          {d.value} {data.unit}
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={zoneInfo.badgeColor}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#metricGrad)"
                  dot={{ r: 4, fill: zoneInfo.badgeColor, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Measurements Table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{
            padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-color)",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Measurement History</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {measurements.length} reading{measurements.length !== 1 ? "s" : ""}
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--color-neutral-50)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 1.25rem", fontWeight: 600, color: "var(--text-secondary)" }}>Date</th>
                <th style={{ padding: "0.75rem 1.25rem", fontWeight: 600, color: "var(--text-secondary)" }}>Value</th>
                <th style={{ padding: "0.75rem 1.25rem", fontWeight: 600, color: "var(--text-secondary)" }}>Status Zone</th>
                <th style={{ padding: "0.75rem 1.25rem", fontWeight: 600, color: "var(--text-secondary)" }}>Source Document</th>
                <th style={{ padding: "0.75rem 1.25rem", fontWeight: 600, color: "var(--text-secondary)" }}>Notes</th>
                <th style={{ padding: "0.75rem 1.25rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMeasurements.map((m) => {
                const mZone = getMetricZoneInfo(data.metric_name, m.value, data.unit, m.reference_range_low, m.reference_range_high);
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "0.85rem 1.25rem", fontWeight: 500 }}>
                      {m.measured_at ? format(new Date(m.measured_at), "MMM d, yyyy h:mm a") : "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", fontWeight: 700 }}>
                      {m.value} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>{data.unit}</span>
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem" }}>
                      <span style={{
                        fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "12px",
                        backgroundColor: mZone.bgColor, color: mZone.textColor, border: `1px solid ${mZone.borderColor}`
                      }}>
                        {mZone.label}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem" }}>
                      {m.document_id ? (
                        <Link href={`/records/${m.document_id}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "var(--color-brand-600)" }}>
                          <FileText size={14} />
                          <span style={{ fontSize: "0.8rem", textDecoration: "underline" }}>
                            {m.document_filename || "View Record"}
                          </span>
                        </Link>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Manual Entry</span>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                      {m.notes || "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                        <button
                          title="Edit reading"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "0.25rem 0.4rem" }}
                          onClick={() => handleOpenEdit(m)}
                        >
                          <Edit2 size={13} color="var(--color-brand-600)" />
                        </button>
                        <button
                          title="Delete reading"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "0.25rem 0.4rem" }}
                          onClick={() => handleDeleteMeasurement(m.id)}
                        >
                          <Trash2 size={13} color="#e11d48" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal for adding/editing metric */}
        <AddMetricModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadSeries}
          editMetric={editingMeasurement ? {
            id: editingMeasurement.id,
            metric_name: data.metric_name,
            metric_category: data.metric_category || "vital",
            value: editingMeasurement.value,
            unit: editingMeasurement.unit,
            measured_at: editingMeasurement.measured_at,
            reference_range_low: editingMeasurement.reference_range_low,
            reference_range_high: editingMeasurement.reference_range_high,
            notes: editingMeasurement.notes,
          } : null}
          presetMetric={!editingMeasurement ? {
            metric_name: data.metric_name,
            metric_category: data.metric_category || "vital",
            unit: data.unit,
          } : null}
        />
      </div>
    </AppLayout>
  );
}

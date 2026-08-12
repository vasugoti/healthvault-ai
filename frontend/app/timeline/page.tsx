"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { timelineApi } from "@/lib/api";
import Link from "next/link";
import {
  Clock, Upload, CheckCircle, AlertTriangle, Activity,
  FileText, User, ChevronDown
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface TimelineEvent {
  id: string; event_type: string; title: string; description: string | null;
  document_id: string | null; metric_id: string | null;
  occurred_at: string; metadata: Record<string, unknown> | null;
}

const EVENT_CONFIG: Record<string, { icon: typeof Upload; color: string; bgColor: string }> = {
  document_uploaded:  { icon: Upload,        color: "#3390f5", bgColor: "#eff6ff" },
  document_processed: { icon: FileText,      color: "#10b981", bgColor: "#ecfdf5" },
  document_failed:    { icon: AlertTriangle, color: "#e11d48", bgColor: "#fff1f2" },
  metric_extracted:   { icon: Activity,      color: "#8b5cf6", bgColor: "#f5f3ff" },
  metric_verified:    { icon: CheckCircle,   color: "#10b981", bgColor: "#ecfdf5" },
  metric_edited:      { icon: Activity,      color: "#f59e0b", bgColor: "#fffbeb" },
  account_created:    { icon: User,          color: "#3390f5", bgColor: "#eff6ff" },
};

export default function TimelinePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadEvents = useCallback(async (p = 1) => {
    p === 1 ? setLoading(true) : setLoadingMore(true);
    try {
      const res = await timelineApi.get({ page: p, page_size: 20 });
      const newEvents = res.data.items || [];
      setEvents((prev) => p === 1 ? newEvents : [...prev, ...newEvents]);
      setTotal(res.data.total || 0);
    } catch { /* handled */ }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => { if (user) loadEvents(1); }, [user, loadEvents]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadEvents(next);
  };

  if (isLoading || !user) return null;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "780px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 className="text-h1" style={{ marginBottom: "0.25rem" }}>Health Timeline</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            A chronological record of everything that's happened in your health vault.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div className="skeleton" style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: "14px", width: "60%", marginBottom: "0.5rem" }} />
                  <div className="skeleton" style={{ height: "12px", width: "40%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Clock size={28} /></div>
            <div className="empty-state-title">No events yet</div>
            <p className="empty-state-desc">
              Your timeline will fill up as you upload reports and verify extracted values.
            </p>
            <Link href="/records">
              <button className="btn btn-primary">Upload your first report →</button>
            </Link>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{
              position: "absolute", left: "17px", top: "18px",
              bottom: "0", width: "2px", background: "var(--color-neutral-150)", zIndex: 0,
            }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {events.map((event, i) => {
                const config = EVENT_CONFIG[event.event_type] || {
                  icon: Clock, color: "#94a3b8", bgColor: "#f8fafc",
                };
                const Icon = config.icon;

                return (
                  <div key={event.id} className="animate-fade-in" style={{
                    display: "flex", gap: "1rem", paddingBottom: "1.5rem", position: "relative", zIndex: 1,
                    animationDelay: `${i * 0.03}s`,
                  }}>
                    {/* Icon bubble */}
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: config.bgColor,
                      border: `2px solid ${config.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: "2px",
                    }}>
                      <Icon size={15} color={config.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, paddingTop: "4px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
                          {event.title}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", flexShrink: 0 }}>
                          {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                        </div>
                      </div>
                      {event.description && (
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.5 }}>
                          {event.description}
                        </p>
                      )}
                      {/* Deep links */}
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        {event.document_id && (
                          <Link href={`/records/${event.document_id}`} className="provenance-link">
                            <FileText size={10} /> View report <span style={{ fontSize: "0.65rem" }}>→</span>
                          </Link>
                        )}
                        {event.metric_id && (
                          <Link href={`/metrics/${event.metric_id}`} className="provenance-link">
                            <Activity size={10} /> View metric <span style={{ fontSize: "0.65rem" }}>→</span>
                          </Link>
                        )}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
                        {format(new Date(event.occurred_at), "MMMM d, yyyy · h:mm a")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {events.length < total && (
              <button
                className="btn btn-secondary"
                onClick={loadMore}
                disabled={loadingMore}
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                {loadingMore ? "Loading..." : (
                  <><ChevronDown size={15} /> Load more events</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import AddReminderModal, { ReminderItem } from "@/components/AddReminderModal";
import { remindersApi, settingsApi } from "@/lib/api";
import {
  Bell, Plus, CheckCircle, Clock, Calendar, Edit2, Trash2,
  AlertTriangle, RefreshCw, Filter, PauseCircle, PlayCircle, FileText,
  Mail, Send, Save, Loader2, Check
} from "lucide-react";
import { format, formatDistanceToNow, isBefore, isAfter, addDays, parseISO } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Categories",
  diabetes: "Diabetes & Glucose",
  blood_test: "Blood & Lab Reports",
  lipid: "Lipid & Cholesterol",
  thyroid: "Thyroid Panel",
  doctor_visit: "Doctor Visit",
  other: "Other Tests",
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  diabetes: { bg: "#fef3c7", border: "#fde68a", text: "#92400e" },
  blood_test: { bg: "#e0f2fe", border: "#bae6fd", text: "#075985" },
  lipid: { bg: "#f3e8ff", border: "#e9d5ff", text: "#6b21a8" },
  thyroid: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  doctor_visit: { bg: "#ffedd5", border: "#fed7aa", text: "#9a3412" },
  other: { bg: "#f1f5f9", border: "#e2e8f0", text: "#475569" },
};

export default function RemindersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);

  // Email Notification settings state
  const [notificationEmailInput, setNotificationEmailInput] = useState<string>("");
  const [effectiveEmail, setEffectiveEmail] = useState<string>("");
  const [savingEmail, setSavingEmail] = useState<boolean>(false);
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadReminders = useCallback(async () => {
    try {
      const res = await remindersApi.list();
      setReminders(res.data || []);
    } catch (err) {
      console.error("Failed to load reminders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotificationEmail = useCallback(async () => {
    try {
      const profileRes = await settingsApi.getProfile();
      const notifEmail = profileRes.data.notification_email || "";
      const effEmail = profileRes.data.effective_notification_email || profileRes.data.email || "";
      setNotificationEmailInput(notifEmail);
      setEffectiveEmail(effEmail);
    } catch (err) {
      console.error("Failed to load notification email settings:", err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadReminders();
      loadNotificationEmail();
    }
  }, [user, loadReminders, loadNotificationEmail]);

  const handleMarkComplete = async (reminder: ReminderItem) => {
    const due = parseISO(reminder.next_due_date);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (isAfter(due, todayEnd)) {
      alert(`⚠️ Cannot Complete Future Reminder:\n\n"${reminder.title}" is scheduled for ${format(due, "MMM d, yyyy")}.\n\nHealth test reminders can only be marked completed on or after their target test date.`);
      return;
    }

    try {
      await remindersApi.complete(reminder.id);
      await loadReminders();
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || "Failed to mark reminder completed.";
      alert(`⚠️ Cannot Complete Reminder:\n\n${detailMsg}`);
    }
  };

  const handleToggleActive = async (reminder: ReminderItem) => {
    try {
      await remindersApi.update(reminder.id, { is_active: !reminder.is_active });
      await loadReminders();
    } catch (err) {
      console.error(err);
      alert("Failed to toggle reminder status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this test reminder?")) return;
    try {
      await remindersApi.delete(id);
      await loadReminders();
    } catch (err) {
      console.error(err);
      alert("Failed to delete reminder.");
    }
  };

  const handleSaveNotificationEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingEmail(true);
    setEmailStatusMsg(null);
    try {
      const target = notificationEmailInput.trim() ? notificationEmailInput.trim() : null;
      const res = await settingsApi.updateNotificationEmail(target);
      setEffectiveEmail(res.data.effective_notification_email || user?.email || "");
      setEmailStatusMsg({
        type: "success",
        text: res.data.message || "Notification email saved successfully!",
      });
    } catch (err: any) {
      console.error(err);
      setEmailStatusMsg({
        type: "error",
        text: err.response?.data?.detail || "Failed to update notification email.",
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setEmailStatusMsg(null);
    try {
      const res = await settingsApi.sendTestEmail();
      setEmailStatusMsg({
        type: "success",
        text: res.data?.message || `Test email sent to ${effectiveEmail}! Check your inbox.`,
      });
    } catch (err: any) {
      console.error(err);
      setEmailStatusMsg({
        type: "error",
        text: err.response?.data?.detail || "Failed to send test email. Ensure SMTP settings are configured in backend/.env",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleOpenEdit = (reminder: ReminderItem) => {
    setEditingReminder(reminder);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingReminder(null);
    setIsModalOpen(true);
  };

  if (isLoading || !user) return null;

  const now = new Date();

  // Metrics computation
  const activeReminders = reminders.filter((r) => r.is_active);
  const overdueCount = activeReminders.filter((r) => isBefore(parseISO(r.next_due_date), now)).length;
  const thirtyDaysHence = addDays(now, 30);
  const dueSoonCount = activeReminders.filter((r) => {
    const due = parseISO(r.next_due_date);
    return isAfter(due, now) && isBefore(due, thirtyDaysHence);
  }).length;
  const recurringCount = activeReminders.filter((r) => r.reminder_type === "recurring").length;

  // Filtered list
  const filteredReminders = reminders.filter((r) => {
    // Category filter
    if (activeCategory !== "all" && r.category !== activeCategory) return false;

    // Tab filter
    if (activeTab === "due_soon") {
      if (!r.is_active) return false;
      const due = parseISO(r.next_due_date);
      return isBefore(due, thirtyDaysHence);
    }
    if (activeTab === "recurring") {
      return r.is_active && r.reminder_type === "recurring";
    }
    if (activeTab === "one_time") {
      return r.is_active && r.reminder_type === "one_time";
    }
    if (activeTab === "completed") {
      return !r.is_active || r.last_completed_date != null;
    }
    return true;
  });

  const getStatusBadge = (r: ReminderItem) => {
    if (!r.is_active) {
      return (
        <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "12px", background: "#f1f5f9", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <PauseCircle size={12} /> Paused
        </span>
      );
    }
    const due = parseISO(r.next_due_date);
    if (isBefore(due, now)) {
      return (
        <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <AlertTriangle size={12} /> Overdue ({formatDistanceToNow(due)} ago)
        </span>
      );
    }
    if (isBefore(due, thirtyDaysHence)) {
      return (
        <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "12px", background: "#fff7ed", color: "#c2410c", border: "1px solid #ffedd5", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <Clock size={12} /> Due Soon (in {formatDistanceToNow(due)})
        </span>
      );
    }
    return (
      <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "12px", background: "#f0fdf4", color: "#15803d", border: "1px solid #dcfce7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
        <Calendar size={12} /> Upcoming (due {format(due, "MMM d, yyyy")})
      </span>
    );
  };

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <Bell size={24} color="var(--color-brand-600)" />
              <h1 className="text-h1" style={{ margin: 0 }}>
                Health Test Reminders
              </h1>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
              Never miss routine lab tests, blood sugar monitors, or follow-up doctor appointments
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleOpenAdd} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Plus size={16} /> Schedule Reminder
          </button>
        </div>

        {/* Email Reminder Notifications Settings Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid #cbd5e1",
            borderRadius: "16px",
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: "260px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Mail size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Email Reminder Notifications
                </h3>
                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.15rem 0 0" }}>
                  Active target: <strong style={{ color: "#1e293b" }}>{effectiveEmail || user?.email}</strong>
                  {notificationEmailInput ? " (Custom)" : " (Default account email)"}
                </p>
              </div>
            </div>

            {/* Email form & Action buttons */}
            <form onSubmit={handleSaveNotificationEmail} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
              <div style={{ position: "relative", minWidth: "240px" }}>
                <input
                  type="email"
                  placeholder={user?.email || "Enter notification email"}
                  value={notificationEmailInput}
                  onChange={(e) => setNotificationEmailInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.825rem",
                    color: "#0f172a",
                    background: "#ffffff",
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={savingEmail}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  transition: "all 0.15s",
                  opacity: savingEmail ? 0.7 : 1,
                }}
              >
                {savingEmail ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Email
              </button>

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTest}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  transition: "all 0.15s",
                  opacity: sendingTest ? 0.7 : 1,
                }}
              >
                {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send Test Email
              </button>
            </form>
          </div>

          {/* Feedback alert toast */}
          {emailStatusMsg && (
            <div
              style={{
                marginTop: "0.85rem",
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: emailStatusMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
                color: emailStatusMsg.type === "success" ? "#166534" : "#991b1b",
                border: `1px solid ${emailStatusMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              }}
            >
              {emailStatusMsg.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
              <span>{emailStatusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Metric Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <div style={{ padding: "1.25rem", borderRadius: "14px", background: "var(--surface-card, #ffffff)", border: "1px solid var(--border-color, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Overdue Tests</span>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
                <AlertTriangle size={15} />
              </div>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: overdueCount > 0 ? "#dc2626" : "var(--text-primary)" }}>
              {overdueCount}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>Requires immediate attention</p>
          </div>

          <div style={{ padding: "1.25rem", borderRadius: "14px", background: "var(--surface-card, #ffffff)", border: "1px solid var(--border-color, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Due Next 30 Days</span>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", color: "#ea580c" }}>
                <Clock size={15} />
              </div>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {dueSoonCount}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>Lab tests or checkups due soon</p>
          </div>

          <div style={{ padding: "1.25rem", borderRadius: "14px", background: "var(--surface-card, #ffffff)", border: "1px solid var(--border-color, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Recurring</span>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7" }}>
                <RefreshCw size={15} />
              </div>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {recurringCount}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>Auto-advancing recurring monitors</p>
          </div>
        </div>

        {/* Filter Bar & Tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          {/* Main Filter Tabs */}
          <div style={{ display: "flex", gap: "0.35rem", background: "var(--color-neutral-100, #f1f5f9)", padding: "0.25rem", borderRadius: "10px" }}>
            {[
              { id: "all", label: "All Reminders" },
              { id: "due_soon", label: `Due / Overdue (${overdueCount + dueSoonCount})` },
              { id: "recurring", label: "Recurring Tests" },
              { id: "one_time", label: "One-Time Dates" },
              { id: "completed", label: "Completed / Paused" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  border: "none",
                  background: activeTab === tab.id ? "#ffffff" : "transparent",
                  boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  fontSize: "0.8rem",
                  color: activeTab === tab.id ? "var(--color-brand-600, #2563eb)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color, #cbd5e1)",
                fontSize: "0.8rem",
                fontWeight: 500,
                background: "var(--surface-card, #ffffff)",
                color: "var(--text-primary)",
              }}
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reminders List / Grid */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            Loading health reminders...
          </div>
        ) : filteredReminders.length === 0 ? (
          <div
            style={{
              padding: "3.5rem 2rem",
              textAlign: "center",
              background: "var(--surface-card, #ffffff)",
              border: "1px border-dashed var(--border-color, #cbd5e1)",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--color-brand-50, #eff6ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
                color: "var(--color-brand-600, #2563eb)",
              }}
            >
              <Bell size={24} />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem", color: "var(--text-primary)" }}>
              No reminders found
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "400px", margin: "0 auto 1.5rem" }}>
              {activeTab === "due_soon"
                ? "Great news! You have no overdue or upcoming tests due in the next 30 days."
                : "Schedule recurring reminders for your periodic diabetes reports, lipid tests, or annual checkups."}
            </p>
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={15} /> Add Test Reminder
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {filteredReminders.map((r) => {
              const catStyle = CATEGORY_STYLES[r.category] || CATEGORY_STYLES.other;
              const catLabel = CATEGORY_LABELS[r.category] || r.category;
              const due = parseISO(r.next_due_date);

              return (
                <div
                  key={r.id}
                  style={{
                    background: "var(--surface-card, #ffffff)",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    borderRadius: "14px",
                    padding: "1.25rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                  }}
                >
                  <div>
                    {/* Top Row: Category pill & Status badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "6px",
                          background: catStyle.bg,
                          border: `1px solid ${catStyle.border}`,
                          color: catStyle.text,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {catLabel}
                      </span>
                      {getStatusBadge(r)}
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.5rem", color: "var(--text-primary)", lineHeight: 1.3 }}>
                      {r.title}
                    </h3>

                    {/* Repeat info */}
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
                      {r.reminder_type === "recurring" ? (
                        <>
                          <RefreshCw size={13} color="var(--color-brand-600)" />
                          <span>Repeats every {r.frequency_value} {r.frequency_unit}</span>
                        </>
                      ) : (
                        <>
                          <Calendar size={13} color="var(--text-muted)" />
                          <span>One-time test reminder</span>
                        </>
                      )}
                    </div>

                    {/* Notification Alert Lead Time */}
                    <div style={{ fontSize: "0.78rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.6rem" }}>
                      <Bell size={12} color="#2563eb" />
                      <span>
                        Notify: {r.notify_before_days === 0 ? "On due date" : `${r.notify_before_days ?? 1} day${(r.notify_before_days ?? 1) > 1 ? "s" : ""} before`}
                      </span>
                    </div>

                    {/* Due Date & Last Done */}
                    <div style={{ background: "var(--color-neutral-50, #f8fafc)", padding: "0.6rem 0.75rem", borderRadius: "8px", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: r.last_completed_date ? "0.25rem" : 0 }}>
                        <span style={{ color: "var(--text-muted)" }}>Next Due Date:</span>
                        <strong style={{ color: "var(--text-primary)" }}>{format(due, "MMM d, yyyy")}</strong>
                      </div>
                      {r.last_completed_date && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                          <span>Last Completed:</span>
                          <span>{format(parseISO(r.last_completed_date), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {r.notes && (
                      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontStyle: "italic", background: "#fffbeb", border: "1px solid #fef3c7", padding: "0.5rem 0.65rem", borderRadius: "6px", margin: "0 0 1rem" }}>
                        "{r.notes}"
                      </p>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div style={{ borderTop: "1px solid var(--border-color, #f1f5f9)", paddingTop: "0.75rem", marginTop: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button
                      onClick={() => handleMarkComplete(r)}
                      style={{
                        padding: "0.4rem 0.75rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "var(--color-brand-600, #2563eb)",
                        color: "#ffffff",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        transition: "background 0.15s",
                      }}
                    >
                      <CheckCircle size={14} /> Mark Complete
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <button
                        onClick={() => handleToggleActive(r)}
                        title={r.is_active ? "Pause Reminder" : "Resume Reminder"}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: r.is_active ? "var(--text-muted)" : "var(--color-brand-600)",
                          padding: "0.35rem",
                          borderRadius: "6px",
                        }}
                      >
                        {r.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(r)}
                        title="Edit Reminder"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          padding: "0.35rem",
                          borderRadius: "6px",
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        title="Delete Reminder"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                          padding: "0.35rem",
                          borderRadius: "6px",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal component */}
        <AddReminderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadReminders}
          editReminder={editingReminder}
        />
      </div>
    </AppLayout>
  );
}

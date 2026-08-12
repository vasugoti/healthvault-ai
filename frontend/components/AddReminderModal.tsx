"use client";
import { useState, useEffect } from "react";
import { remindersApi } from "@/lib/api";
import { Bell, Calendar, X, Plus, Clock, RefreshCw, AlertCircle } from "lucide-react";

export interface ReminderItem {
  id: string;
  title: string;
  category: string;
  reminder_type: string;
  frequency_value: number | null;
  frequency_unit: string | null;
  next_due_date: string;
  last_completed_date: string | null;
  notes: string | null;
  notify_before_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editReminder?: ReminderItem | null;
}

const COMMON_PRESETS = [
  { title: "HbA1c Diabetes Report", category: "diabetes", type: "recurring", val: 3, unit: "months" },
  { title: "Fasting Blood Sugar", category: "diabetes", type: "recurring", val: 2, unit: "months" },
  { title: "Lipid Profile Panel", category: "lipid", type: "recurring", val: 6, unit: "months" },
  { title: "Thyroid Profile (TSH)", category: "thyroid", type: "recurring", val: 6, unit: "months" },
  { title: "Annual Health Checkup", category: "doctor_visit", type: "recurring", val: 1, unit: "years" },
  { title: "Lab Blood Test Appointment", category: "blood_test", type: "one_time", val: 1, unit: "months" },
];

export default function AddReminderModal({
  isOpen,
  onClose,
  onSuccess,
  editReminder,
}: AddReminderModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("diabetes");
  const [reminderType, setReminderType] = useState("recurring");
  const [frequencyVal, setFrequencyVal] = useState(2);
  const [frequencyUnit, setFrequencyUnit] = useState("months");
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [notifyBeforeDays, setNotifyBeforeDays] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editReminder) {
      setTitle(editReminder.title);
      setCategory(editReminder.category || "diabetes");
      setReminderType(editReminder.reminder_type || "recurring");
      setFrequencyVal(editReminder.frequency_value ?? 2);
      setFrequencyUnit(editReminder.frequency_unit || "months");
      setNextDueDate(editReminder.next_due_date ? editReminder.next_due_date.slice(0, 10) : "");
      setNotes(editReminder.notes || "");
      setNotifyBeforeDays(editReminder.notify_before_days ?? 1);
      setIsActive(editReminder.is_active ?? true);
    } else {
      setTitle("");
      setCategory("diabetes");
      setReminderType("recurring");
      setFrequencyVal(2);
      setFrequencyUnit("months");
      // Default to 2 months from today
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 2);
      setNextDueDate(defaultDate.toISOString().slice(0, 10));
      setNotes("");
      setNotifyBeforeDays(1);
      setIsActive(true);
    }
    setError("");
  }, [editReminder, isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof COMMON_PRESETS[0]) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setReminderType(preset.type);
    setFrequencyVal(preset.val);
    setFrequencyUnit(preset.unit);

    const now = new Date();
    if (preset.unit === "days") now.setDate(now.getDate() + preset.val);
    else if (preset.unit === "weeks") now.setDate(now.getDate() + preset.val * 7);
    else if (preset.unit === "years") now.setFullYear(now.getFullYear() + preset.val);
    else now.setMonth(now.getMonth() + preset.val);

    setNextDueDate(now.toISOString().slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter reminder title.");
      return;
    }
    if (!nextDueDate) {
      setError("Please select the next due date.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (editReminder) {
        await remindersApi.update(editReminder.id, {
          title,
          category,
          reminder_type: reminderType,
          frequency_value: reminderType === "recurring" ? frequencyVal : undefined,
          frequency_unit: reminderType === "recurring" ? frequencyUnit : undefined,
          next_due_date: nextDueDate,
          notes,
          notify_before_days: notifyBeforeDays,
          is_active: isActive,
        });
      } else {
        await remindersApi.create({
          title,
          category,
          reminder_type: reminderType,
          frequency_value: reminderType === "recurring" ? frequencyVal : undefined,
          frequency_unit: reminderType === "recurring" ? frequencyUnit : undefined,
          next_due_date: nextDueDate,
          notes,
          notify_before_days: notifyBeforeDays,
          is_active: isActive,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to save reminder. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
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
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-card, #ffffff)",
          border: "1px solid var(--border-color, #e2e8f0)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {editReminder ? "Edit Test Reminder" : "Schedule Test Reminder"}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
                Set up recurring health report tests or one-time date alerts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "0.25rem",
              borderRadius: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Quick Presets */}
          {!editReminder && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
                Quick Test Presets
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {COMMON_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.35rem 0.65rem",
                      borderRadius: "20px",
                      border: "1px solid var(--border-color, #cbd5e1)",
                      background: title === p.title ? "var(--color-brand-50, #eff6ff)" : "var(--color-neutral-50, #f8fafc)",
                      borderColor: title === p.title ? "var(--color-brand-500, #3b82f6)" : "var(--border-color, #cbd5e1)",
                      color: title === p.title ? "var(--color-brand-700, #1d4ed8)" : "var(--text-primary)",
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "all 0.15s ease",
                    }}
                  >
                    + {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Reminder Title *
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Diabetes HbA1c Test, Lipid Panel Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)" }}
              required
            />
          </div>

          {/* Type Toggle & Category */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Reminder Schedule
              </label>
              <div style={{ display: "flex", gap: "0.35rem", background: "var(--color-neutral-100, #f1f5f9)", padding: "0.25rem", borderRadius: "8px" }}>
                <button
                  type="button"
                  onClick={() => setReminderType("recurring")}
                  style={{
                    flex: 1,
                    padding: "0.4rem",
                    borderRadius: "6px",
                    border: "none",
                    background: reminderType === "recurring" ? "#ffffff" : "transparent",
                    boxShadow: reminderType === "recurring" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    fontWeight: reminderType === "recurring" ? 600 : 500,
                    fontSize: "0.8rem",
                    color: reminderType === "recurring" ? "var(--color-brand-600, #2563eb)" : "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                  }}
                >
                  <RefreshCw size={13} />
                  Recurring
                </button>
                <button
                  type="button"
                  onClick={() => setReminderType("one_time")}
                  style={{
                    flex: 1,
                    padding: "0.4rem",
                    borderRadius: "6px",
                    border: "none",
                    background: reminderType === "one_time" ? "#ffffff" : "transparent",
                    boxShadow: reminderType === "one_time" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    fontWeight: reminderType === "one_time" ? 600 : 500,
                    fontSize: "0.8rem",
                    color: reminderType === "one_time" ? "var(--color-brand-600, #2563eb)" : "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                  }}
                >
                  <Calendar size={13} />
                  One-time
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Category
              </label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)" }}
              >
                <option value="diabetes">Diabetes & Glucose</option>
                <option value="blood_test">Blood & CBC</option>
                <option value="lipid">Lipid & Heart</option>
                <option value="thyroid">Thyroid Panel</option>
                <option value="doctor_visit">Doctor Visit & Consultation</option>
                <option value="other">Other Health Test</option>
              </select>
            </div>
          </div>

          {/* Frequency (for Recurring) */}
          {reminderType === "recurring" && (
            <div style={{ marginBottom: "1.25rem", padding: "0.85rem 1rem", background: "var(--color-brand-50, #f0f9ff)", borderRadius: "10px", border: "1px solid var(--color-brand-100, #e0f2fe)" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-brand-800, #075985)", display: "block", marginBottom: "0.5rem" }}>
                Repeat Frequency
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Every</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={frequencyVal}
                  onChange={(e) => setFrequencyVal(parseInt(e.target.value) || 1)}
                  style={{ width: "70px", padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color, #cbd5e1)", textAlign: "center", fontWeight: 600 }}
                />
                <select
                  value={frequencyUnit}
                  onChange={(e) => setFrequencyUnit(e.target.value)}
                  style={{ flex: 1, padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color, #cbd5e1)" }}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem", marginBottom: 0 }}>
                When marked completed, the next due date automatically shifts forward by {frequencyVal} {frequencyUnit}.
              </p>
            </div>
          )}

          {/* Next Due Date */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              {reminderType === "recurring" ? "First / Next Due Date *" : "Target Test Date *"}
            </label>
            <input
              type="date"
              className="input"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)" }}
              required
            />
          </div>

          {/* When to Notify / Alert Lead Time */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
              <Clock size={14} color="var(--color-brand-600)" /> When to Notify (Email Alert Timing) *
            </label>
            <select
              className="input"
              value={notifyBeforeDays}
              onChange={(e) => setNotifyBeforeDays(parseInt(e.target.value) || 0)}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)" }}
            >
              <option value={1}>1 day before (Default)</option>
              <option value={0}>On the due date (Same day)</option>
              <option value={2}>2 days before</option>
              <option value={3}>3 days before</option>
              <option value={7}>1 week before (7 days)</option>
              <option value={14}>2 weeks before (14 days)</option>
            </select>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem", marginBottom: 0 }}>
              You will receive an email reminder {notifyBeforeDays === 0 ? "on the target test date." : `${notifyBeforeDays} day${notifyBeforeDays > 1 ? "s" : ""} prior to the target test date.`}
            </p>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Notes & Fasting / Prep Instructions (Optional)
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder="e.g. 10-hour fasting required, take report to Dr. Smith..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", resize: "vertical" }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid var(--border-color, #e2e8f0)", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              {loading ? (
                "Saving..."
              ) : editReminder ? (
                "Save Changes"
              ) : (
                <>
                  <Plus size={16} /> Set Reminder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { settingsApi } from "@/lib/api";
import { User, Lock, Shield, Trash2, AlertTriangle, CheckCircle, HelpCircle, LifeBuoy, Mail, MessageSquare, ArrowRight } from "lucide-react";

export default function SettingsPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "privacy" | "support">("profile");

  // Profile state
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Password state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // Privacy state
  const [dataSummary, setDataSummary] = useState<Array<{ category: string; count: number; description: string }> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setDob(user.date_of_birth || "");
      setSex(user.sex || "");
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "privacy" && !dataSummary) {
      settingsApi.getDataSummary().then((res) => setDataSummary(res.data.what_we_store)).catch(() => {});
    }
  }, [activeTab, dataSummary]);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await settingsApi.updateProfile({ full_name: fullName, date_of_birth: dob || null, sex: sex || null });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch { /* handled */ }
    setProfileSaving(false);
  };

  const changePassword = async () => {
    setPwdError("");
    if (newPwd.length < 8) { setPwdError("New password must be at least 8 characters"); return; }
    try {
      await settingsApi.changePassword({ current_password: currentPwd, new_password: newPwd });
      setPwdSaved(true);
      setCurrentPwd(""); setNewPwd("");
      setTimeout(() => setPwdSaved(false), 3000);
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  const deleteAccount = async () => {
    if (deleteInput !== "DELETE") return;
    try {
      await settingsApi.deleteAccount();
      logout();
      router.replace("/auth/login");
    } catch { alert("Failed to delete account. Please try again."); }
  };

  if (isLoading || !user) return null;

  const TABS = [
    { key: "profile",  label: "Profile",  icon: User },
    { key: "security", label: "Security", icon: Lock },
    { key: "privacy",  label: "Privacy",  icon: Shield },
    { key: "support",  label: "Help & Support", icon: HelpCircle },
  ] as const;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "760px", margin: "0 auto" }}>
        <h1 className="text-h1" style={{ marginBottom: "0.25rem" }}>Settings</h1>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
          Manage your profile and account preferences.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "2rem", borderBottom: "1px solid var(--border-color)" }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.625rem 1rem", background: "none", border: "none", cursor: "pointer",
                fontSize: "0.875rem", fontWeight: activeTab === key ? 600 : 400,
                color: activeTab === key ? "var(--color-brand-600)" : "var(--text-secondary)",
                borderBottom: `2px solid ${activeTab === key ? "var(--color-brand-500)" : "transparent"}`,
                marginBottom: "-1px", transition: "all 0.15s",
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === "profile" && (
          <div className="card" style={{ padding: "1.75rem" }}>
            <h2 className="text-h3" style={{ marginBottom: "1.5rem" }}>Profile Information</h2>
            <div className="form-group">
              <label className="label" htmlFor="settings-name">Full name</label>
              <input id="settings-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="settings-email">Email address</label>
              <input id="settings-email" className="input" value={user.email} disabled />
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Email cannot be changed.</p>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="settings-dob">Date of birth</label>
              <input id="settings-dob" className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="settings-sex">Biological sex</label>
              <select id="settings-sex" className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}
              >
                {profileSaving ? "Saving..." : "Save changes"}
              </button>
              {profileSaved && (
                <span style={{ fontSize: "0.8rem", color: "var(--color-verified-text)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <CheckCircle size={14} /> Saved
                </span>
              )}
            </div>
          </div>
        )}

        {/* Security tab */}
        {activeTab === "security" && (
          <div className="card" style={{ padding: "1.75rem" }}>
            <h2 className="text-h3" style={{ marginBottom: "1.5rem" }}>Change Password</h2>
            {pwdError && (
              <div style={{
                padding: "0.75rem", background: "var(--color-error-bg)", border: "1px solid var(--color-error-border)",
                borderRadius: "8px", marginBottom: "1.25rem", fontSize: "0.8rem", color: "var(--color-error-text)",
                display: "flex", alignItems: "center", gap: "0.375rem",
              }}>
                <AlertTriangle size={14} /> {pwdError}
              </div>
            )}
            <div className="form-group">
              <label className="label" htmlFor="current-pwd">Current password</label>
              <input id="current-pwd" className="input" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="new-pwd">New password</label>
              <input id="new-pwd" className="input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="8+ characters" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button className="btn btn-primary" onClick={changePassword}>Change password</button>
              {pwdSaved && (
                <span style={{ fontSize: "0.8rem", color: "var(--color-verified-text)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <CheckCircle size={14} /> Password changed
                </span>
              )}
            </div>
          </div>
        )}

        {/* Privacy tab */}
        {activeTab === "privacy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* What we store */}
            <div className="card" style={{ padding: "1.75rem" }}>
              <h2 className="text-h3" style={{ marginBottom: "0.5rem" }}>What we store</h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                All data is stored in your local PostgreSQL database. No data is shared with third parties. AI responses are generated using Google Gemini — your health data is sent to Google&apos;s API for processing.
              </p>
              {dataSummary ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Count</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataSummary.map((item) => (
                        <tr key={item.category}>
                          <td style={{ fontWeight: 600 }}>{item.category}</td>
                          <td className="data-value" style={{ fontWeight: 700 }}>{item.count}</td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{item.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="skeleton" style={{ height: "160px" }} />
              )}
            </div>

            {/* Delete account */}
            <div className="card" style={{ padding: "1.75rem", border: "1px solid var(--color-error-border)" }}>
              <h2 className="text-h3" style={{ marginBottom: "0.5rem", color: "var(--color-error-text)" }}>
                Delete account
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                Permanently delete your account and all associated data — documents, extracted metrics, AI conversations, and timeline. This action cannot be undone.
              </p>
              {!deleteConfirm ? (
                <button className="btn btn-danger" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 size={14} /> Delete my account
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.75rem" }}>
                    Type <strong>DELETE</strong> to confirm:
                  </p>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <input
                      className="input"
                      placeholder="DELETE"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                    />
                    <button
                      className="btn btn-danger"
                      onClick={deleteAccount}
                      disabled={deleteInput !== "DELETE"}
                    >
                      Confirm delete
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Support tab */}
        {activeTab === "support" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="card" style={{ padding: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "12px",
                  background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "white"
                }}>
                  <LifeBuoy size={24} />
                </div>
                <div>
                  <h2 className="text-h3" style={{ marginBottom: "0.25rem" }}>Help & Support Center</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                    Access guides, contact our team, or send feedback.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <button
                  onClick={() => router.push("/help")}
                  style={{
                    padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border-color)",
                    background: "var(--color-neutral-50)", textAlign: "left", cursor: "pointer"
                  }}
                >
                  <HelpCircle size={22} color="var(--color-brand-600)" style={{ marginBottom: "0.5rem" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>Browse FAQs</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Common questions & guides</div>
                </button>

                <button
                  onClick={() => router.push("/help")}
                  style={{
                    padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border-color)",
                    background: "var(--color-neutral-50)", textAlign: "left", cursor: "pointer"
                  }}
                >
                  <Mail size={22} color="#10b981" style={{ marginBottom: "0.5rem" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>Contact Support</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>24/7 email support</div>
                </button>

                <button
                  onClick={() => router.push("/help")}
                  style={{
                    padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border-color)",
                    background: "var(--color-neutral-50)", textAlign: "left", cursor: "pointer"
                  }}
                >
                  <MessageSquare size={22} color="#f59e0b" style={{ marginBottom: "0.5rem" }} />
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>Send Feedback</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Feature requests & bug reports</div>
                </button>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => router.push("/help")}
                style={{ width: "100%", justifyContent: "center", borderRadius: "10px", padding: "0.75rem" }}
              >
                Open Help & Support Hub <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

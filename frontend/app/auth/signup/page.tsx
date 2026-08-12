"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, AlertCircle, ArrowRight, Plus, X } from "lucide-react";

type Step = "account" | "profile";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Profile fields
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");
  const [condition, setCondition] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);

  const addCondition = () => {
    if (condition.trim() && !conditions.includes(condition.trim())) {
      setConditions([...conditions, condition.trim()]);
      setCondition("");
    }
  };

  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setStep("profile");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signup({
        email,
        password,
        full_name: fullName,
        date_of_birth: dob || undefined,
        sex: sex || undefined,
        user_entered_conditions: conditions,
      });
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      padding: "2rem",
    }}>
      <div style={{
        width: "100%", maxWidth: "480px",
        background: "white", borderRadius: "20px", padding: "2.5rem",
        boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "2rem" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck size={18} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>HealthVault AI</span>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem" }}>
          {(["account", "profile"] as Step[]).map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                background: step === s || (s === "account" && step === "profile") ? "var(--color-brand-600)" : "var(--color-neutral-200)",
                color: step === s || (s === "account" && step === "profile") ? "white" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</div>
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: step === s ? "var(--text-primary)" : "var(--text-muted)" }}>
                {s === "account" ? "Account" : "Health Profile"}
              </span>
              {i < 1 && <div style={{ width: "24px", height: "1px", background: "var(--border-color)" }} />}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.75rem", background: "var(--color-error-bg)",
            border: "1px solid var(--color-error-border)", borderRadius: "8px",
            marginBottom: "1.25rem", fontSize: "0.8rem", color: "var(--color-error-text)",
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {step === "account" ? (
          <form id="signup-account-form" onSubmit={handleAccountNext}>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Create your account</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              Already have one?{" "}
              <Link href="/auth/login" style={{ color: "var(--color-brand-600)", fontWeight: 500 }}>Sign in</Link>
            </p>
            <div className="form-group">
              <label className="label" htmlFor="fullName">Full name</label>
              <input id="fullName" className="input" placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="signupEmail">Email address</label>
              <input id="signupEmail" className="input" type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="signupPassword">Password</label>
              <input id="signupPassword" className="input" type="password" placeholder="8+ characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <button id="signup-next" type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
              Continue <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form id="signup-profile-form" onSubmit={handleSubmit}>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Health profile</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Optional but helps personalize your experience. All fields are user-entered — not diagnosed by HealthVault AI.
            </p>
            <div className="form-group">
              <label className="label" htmlFor="dob">Date of birth</label>
              <input id="dob" className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="sex">Biological sex</label>
              <select id="sex" className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="condition">
                Conditions you manage <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(as entered by you, not diagnosed)</span>
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  id="condition" className="input" placeholder="e.g. Diabetes, Hypertension"
                  value={condition} onChange={(e) => setCondition(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCondition(); }}}
                />
                <button type="button" className="btn btn-secondary" onClick={addCondition}><Plus size={16} /></button>
              </div>
              {conditions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem" }}>
                  {conditions.map((c) => (
                    <span key={c} className="badge badge-info" style={{ gap: "0.35rem" }}>
                      {c}
                      <button onClick={() => setConditions(conditions.filter((x) => x !== c))} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0, color: "inherit" }}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep("account")} style={{ flex: 1 }}>Back</button>
              <button id="signup-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
                {loading ? "Creating account..." : "Create account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

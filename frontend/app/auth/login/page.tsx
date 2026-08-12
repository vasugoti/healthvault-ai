"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "4rem", color: "white", maxWidth: "560px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "3rem" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck size={22} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>HealthVault AI</div>
            <div style={{ fontSize: "0.65rem", color: "var(--color-brand-400)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Personal Health Intelligence
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.15, marginBottom: "1rem", letterSpacing: "-0.025em" }}>
          Your health data,<br />finally organized.
        </h1>
        <p style={{ fontSize: "1rem", color: "#94a3b8", lineHeight: 1.7, maxWidth: "440px" }}>
          Upload your lab reports and medical documents. HealthVault AI extracts, tracks, and explains your health data — grounded in your own records, never guesswork.
        </p>

        <div style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[
            { icon: "📄", label: "Structured extraction from any lab report format" },
            { icon: "📈", label: "Longitudinal trend tracking across all your reports" },
            { icon: "🤖", label: "AI answers grounded in your data, with citations" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.1rem", marginTop: "2px" }}>{f.icon}</span>
              <span style={{ fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.5 }}>{f.label}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: "3rem", padding: "1rem 1.25rem",
          background: "rgba(255,255,255,0.05)", borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.8rem", color: "#94a3b8",
        }}>
          <strong style={{ color: "#e2e8f0" }}>No diagnoses. Ever.</strong> HealthVault AI describes what your data shows — never what it means medically.
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2rem",
      }}>
        <div style={{
          width: "100%", maxWidth: "420px",
          background: "white", borderRadius: "20px", padding: "2.5rem",
          boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
        }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.375rem", color: "var(--text-primary)" }}>
            Sign in
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" style={{ color: "var(--color-brand-600)", fontWeight: 500 }}>
              Create one
            </Link>
          </p>

          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 1rem", background: "var(--color-error-bg)",
              border: "1px solid var(--color-error-border)", borderRadius: "8px",
              marginBottom: "1.25rem", fontSize: "0.875rem", color: "var(--color-error-text)",
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  className="input"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0,
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: "100%", marginTop: "0.5rem" }}
            >
              {loading ? "Signing in..." : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

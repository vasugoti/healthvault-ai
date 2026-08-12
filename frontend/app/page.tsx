"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/auth/login");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--surface-page)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H9V8h2v9zm4 0h-2V8h2v9z"/>
          </svg>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Loading HealthVault AI...</p>
      </div>
    </div>
  );
}

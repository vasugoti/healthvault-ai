"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, FileText, Activity, Pill, Clock, MessageSquare,
  Settings, Search, LogOut, ShieldCheck, Bell, HelpCircle
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",      icon: LayoutDashboard },
  { href: "/records",    label: "Health Records",  icon: FileText },
  { href: "/metrics",    label: "Health Metrics",  icon: Activity },
  { href: "/medications", label: "Medications",    icon: Pill },
  { href: "/reminders",   label: "Reminders",      icon: Bell },
  { href: "/timeline",   label: "Timeline",        icon: Clock },
  { href: "/assistant",  label: "AI Assistant",    icon: MessageSquare },
];

const BOTTOM_NAV = [
  { href: "/help",       label: "Help & Support",  icon: HelpCircle },
  { href: "/settings",   label: "Settings",        icon: Settings },
];



export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-page)" }}>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <ShieldCheck size={18} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                HealthVault
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--color-brand-600)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                AI
              </div>
            </div>
          </Link>
        </div>

        {/* Search */}
        <div style={{ padding: "0 0.75rem 0.75rem" }}>
          <Link href="/search" style={{ textDecoration: "none" }}>
            <button className="nav-item" style={{ borderRadius: "8px", background: "var(--color-neutral-50)" }}>
              <Search size={16} />
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>Search...</span>
            </button>
          </Link>
        </div>

        {/* Main Nav */}
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <button
                className={`nav-item ${pathname === href || pathname.startsWith(href + "/") ? "active" : ""}`}
              >
                <Icon size={17} className="nav-icon" />
                {label}
              </button>
            </Link>
          ))}
        </nav>

        {/* Bottom Nav */}
        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <button className={`nav-item ${pathname === href ? "active" : ""}`}>
                <Icon size={17} className="nav-icon" />
                {label}
              </button>
            </Link>
          ))}

          {/* User info + logout */}
          <div style={{ padding: "0.75rem 1.25rem 0.5rem", borderTop: "1px solid var(--color-neutral-100)", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: "0.8rem", fontWeight: 600, flexShrink: 0,
              }}>
                {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.full_name}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.email}
                </div>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-secondary)" }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}

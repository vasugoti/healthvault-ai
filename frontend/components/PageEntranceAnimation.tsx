"use client";
import React, { useEffect, useState } from "react";
import { ShieldCheck, Sparkles, Activity } from "lucide-react";

export default function PageEntranceAnimation() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Check if session splash already played in this page session if desired,
    // or trigger on every fresh page load/refresh!
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setFadeOut(true), 150);
          setTimeout(() => setVisible(false), 750);
          return 100;
        }
        return prev + Math.floor(Math.random() * 25 + 15);
      });
    }, 90);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: "radial-gradient(circle at center, #0f172a 0%, #020617 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? "scale(1.08) translateY(-10px)" : "scale(1) translateY(0)",
        filter: fadeOut ? "blur(8px)" : "blur(0px)",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: fadeOut ? "none" : "auto",
        overflow: "hidden",
      }}
    >
      {/* Background Animated Particle Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(16, 185, 129, 0.15) 1px, transparent 1px), radial-gradient(rgba(29, 116, 232, 0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
          opacity: 0.6,
          animation: "gridPulse 4s ease-in-out infinite alternate",
        }}
      />

      {/* Floating Glowing Neon Orbs */}
      <div
        style={{
          position: "absolute",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(0,0,0,0) 70%)",
          top: "20%",
          left: "25%",
          filter: "blur(40px)",
          animation: "floatOrb 6s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(29, 116, 232, 0.3) 0%, rgba(0,0,0,0) 70%)",
          bottom: "15%",
          right: "20%",
          filter: "blur(50px)",
          animation: "floatOrb 7s ease-in-out infinite alternate-reverse",
        }}
      />

      {/* Center Shield & Rotating Rings */}
      <div
        style={{
          position: "relative",
          width: "120px",
          height: "120px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.75rem",
        }}
      >
        {/* Outer Rotating Glowing Ring */}
        <div
          style={{
            position: "absolute",
            inset: "-12px",
            borderRadius: "50%",
            border: "2px dashed rgba(16, 185, 129, 0.6)",
            animation: "spin 8s linear infinite",
            boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)",
          }}
        />

        {/* Inner Counter-Rotating Ring */}
        <div
          style={{
            position: "absolute",
            inset: "-4px",
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "#3b82f6",
            borderBottomColor: "#10b981",
            animation: "spinReverse 4s linear infinite",
          }}
        />

        {/* Shield Icon Box */}
        <div
          style={{
            width: "84px",
            height: "84px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, #10b981 0%, #1d74e8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 35px rgba(16, 185, 129, 0.45), 0 0 20px rgba(29, 116, 232, 0.4)",
            transform: "perspective(500px) rotateY(0deg)",
            animation: "pulseIcon 2s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate",
          }}
        >
          <ShieldCheck size={44} color="#ffffff" strokeWidth={2.2} />
        </div>
      </div>

      {/* Brand Title */}
      <div style={{ textAlign: "center", zIndex: 10 }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "0.05em",
            margin: "0 0 0.3rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            textShadow: "0 2px 10px rgba(255,255,255,0.2)",
          }}
        >
          HealthVault <span style={{ color: "#10b981" }}>AI</span>
          <Sparkles size={20} color="#38bdf8" />
        </h1>
        <p
          style={{
            fontSize: "0.8rem",
            color: "#94a3b8",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontWeight: 600,
            margin: "0 0 1.5rem 0",
          }}
        >
          Personal Health Intelligence Platform
        </p>

        {/* Heartbeat ECG Line Animation */}
        <div
          style={{
            width: "220px",
            height: "28px",
            margin: "0 auto 1.5rem auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Activity size={24} color="#10b981" style={{ animation: "heartbeat 1.2s infinite" }} />
          <svg
            width="180"
            height="24"
            viewBox="0 0 180 24"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginLeft: "8px" }}
          >
            <path
              d="M0 12 H30 L40 2 L50 22 L65 4 L75 16 L85 12 H180"
              strokeDasharray="200"
              strokeDashoffset={200 - (progress / 100) * 200}
              style={{ transition: "stroke-dashoffset 0.2s ease" }}
            />
          </svg>
        </div>

        {/* Loading Progress Bar */}
        <div
          style={{
            width: "260px",
            height: "6px",
            borderRadius: "10px",
            backgroundColor: "rgba(255,255,255,0.1)",
            overflow: "hidden",
            margin: "0 auto 0.75rem auto",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #10b981, #3b82f6, #6366f1)",
              borderRadius: "10px",
              boxShadow: "0 0 12px rgba(16, 185, 129, 0.8)",
              transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#64748b",
            letterSpacing: "0.1em",
          }}
        >
          INITIALIZING... {progress}%
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spinReverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes floatOrb {
          0% { transform: translateY(0px) scale(1); }
          100% { transform: translateY(-30px) scale(1.1); }
        }
        @keyframes pulseIcon {
          0% { transform: scale(0.96); boxShadow: 0 0 20px rgba(16, 185, 129, 0.3); }
          100% { transform: scale(1.04); boxShadow: 0 0 45px rgba(16, 185, 129, 0.7); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.25); }
          30% { transform: scale(1); }
          45% { transform: scale(1.15); }
        }
        @keyframes gridPulse {
          0% { opacity: 0.3; }
          100% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useReplay } from "@/contexts/ReplayContext";
import { playWarningSound } from "@/lib/audio/alarm";

export function CriticalFiredModal() {
  const { showHeroModal, dismissHeroModal } = useReplay();
  const audioFiredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showHeroModal) {
      audioFiredRef.current = false;
      return;
    }

    // Play audio once if not muted
    if (!audioFiredRef.current) {
      audioFiredRef.current = true;
      try {
        const muted = localStorage.getItem("floodsentinel_muted") === "true";
        if (!muted) playWarningSound();
      } catch {}
    }

    // Auto-dismiss after 4 seconds
    timerRef.current = setTimeout(dismissHeroModal, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [showHeroModal, dismissHeroModal]);

  if (!showHeroModal) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismissHeroModal}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 900,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Modal card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "white",
            border: "3px solid #DC2626",
            borderRadius: 8,
            width: 380,
            boxShadow: "0 0 60px rgba(220,38,38,0.4), 0 20px 40px rgba(0,0,0,0.4)",
            overflow: "hidden",
            animation: "modal-in 0.25s ease-out",
          }}
        >
          {/* Header */}
          <div style={{
            background: "#DC2626",
            padding: "14px 20px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🚨</div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: "white",
              fontFamily: "var(--font-merriweather), serif",
              letterSpacing: "0.04em",
            }}>
              CRITICAL FIRED
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "20px 24px" }}>
            {/* Comparison */}
            <div style={{
              display: "flex", gap: 12, marginBottom: 16,
            }}>
              <div style={{
                flex: 1, textAlign: "center",
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 6, padding: "10px 8px",
              }}>
                <p style={{ margin: 0, fontSize: 10, color: "#991B1B", fontWeight: 700, fontFamily: "var(--font-source-code-pro), monospace" }}>FLOOD SENTINEL</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "#DC2626" }}>June 14, 16:00</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", color: "#9CA3AF", fontSize: 18 }}>→</div>
              <div style={{
                flex: 1, textAlign: "center",
                background: "#FFF7ED", border: "1px solid #FED7AA",
                borderRadius: 6, padding: "10px 8px",
              }}>
                <p style={{ margin: 0, fontSize: 10, color: "#92400E", fontWeight: 700, fontFamily: "var(--font-source-code-pro), monospace" }}>BWDB OFFICIAL</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "#D97706" }}>June 16, 00:00</p>
              </div>
            </div>

            {/* The gap callout */}
            <div style={{
              textAlign: "center",
              background: "linear-gradient(135deg, #FEF2F2, #FFF1F2)",
              border: "2px solid #DC2626",
              borderRadius: 6, padding: "12px",
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 28, fontWeight: 900, color: "#DC2626",
                fontFamily: "var(--font-merriweather), serif",
                letterSpacing: "-0.02em",
              }}>
                32 HOURS AHEAD
              </div>
              <div style={{
                width: 80, height: 2, background: "#DC2626",
                margin: "8px auto",
              }} />
            </div>

            {/* Impact statement */}
            <p style={{
              textAlign: "center", fontSize: 13, color: "#374151",
              lineHeight: 1.6, margin: "0 0 16px",
              fontFamily: "var(--font-noto-sans-bengali), sans-serif",
            }}>
              267,000 people now have evacuation time they didn&apos;t.
            </p>

            {/* Dismiss button */}
            <button
              onClick={dismissHeroModal}
              style={{
                width: "100%", background: "#DC2626", color: "white",
                border: "none", padding: "10px",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                borderRadius: 4,
                fontFamily: "var(--font-noto-sans-bengali), sans-serif",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

"use client";

import { useReplay } from "@/contexts/ReplayContext";

export function ReplayBanner() {
  const { isActive, currentHour, currentFrame, stop } = useReplay();
  if (!isActive) return null;

  const hourLabel = currentHour === 0
    ? "T-0 · BWDB Warning Issued"
    : `T${currentHour}h`;

  return (
    <div style={{
      background: "linear-gradient(90deg, #92400E 0%, #B45309 50%, #92400E 100%)",
      borderBottom: "2px solid #F59E0B",
      flexShrink: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 20px",
      }}>
        {/* Left: mode label */}
        <span style={{
          fontSize: 11, fontWeight: 800, color: "#FEF3C7",
          fontFamily: "var(--font-source-code-pro), monospace",
          letterSpacing: "0.1em", flexShrink: 0,
          background: "rgba(0,0,0,0.25)",
          padding: "3px 8px", borderRadius: 3,
        }}>
          ⏪ REPLAY MODE
        </span>

        <span style={{ color: "rgba(254,243,199,0.5)", flexShrink: 0 }}>·</span>

        <span style={{
          color: "#FEF3C7", fontWeight: 700, fontSize: 12,
          fontFamily: "var(--font-source-code-pro), monospace",
          flexShrink: 0,
        }}>
          2022 Sylhet Mega-Flood
        </span>

        <span style={{ color: "rgba(254,243,199,0.5)", flexShrink: 0 }}>·</span>

        {/* Timestamp */}
        <span style={{
          color: "#FDE68A", fontSize: 12,
          fontFamily: "var(--font-source-code-pro), monospace",
          fontWeight: 600,
        }}>
          {currentFrame.timestamp}
        </span>

        <span style={{
          fontSize: 11, color: "rgba(254,243,199,0.7)",
          fontFamily: "var(--font-source-code-pro), monospace",
        }}>
          [{hourLabel}]
        </span>

        <div style={{ flex: 1 }} />

        {/* Exit button */}
        <button
          onClick={stop}
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(254,243,199,0.4)",
            color: "#FEF3C7",
            padding: "4px 12px", fontSize: 11, fontWeight: 700,
            cursor: "pointer", borderRadius: 3,
            fontFamily: "var(--font-source-code-pro), monospace",
            letterSpacing: "0.04em",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.3)")}
        >
          ✕ Exit Replay
        </button>
      </div>
    </div>
  );
}

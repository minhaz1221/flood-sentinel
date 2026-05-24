"use client";

interface DemoHeroBannerProps {
  onReplay: () => void;
  onDismiss: () => void;
}

export function DemoHeroBanner({ onReplay, onDismiss }: DemoHeroBannerProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #003d82 0%, #1a56a0 55%, #2471b5 100%)",
      color: "white",
      padding: "14px 24px",
      display: "flex",
      alignItems: "center",
      gap: 20,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontWeight: 700,
          fontSize: 14,
          fontFamily: "var(--font-merriweather), serif",
          lineHeight: 1.4,
        }}>
          Flood Sentinel detected the 2022 Sylhet Mega-Flood{" "}
          <span style={{ color: "#fbbf24" }}>32 hours before</span> BWDB issued any warning.
        </p>
        <p style={{
          margin: "3px 0 0",
          fontSize: 12,
          opacity: 0.82,
          fontFamily: "var(--font-source-code-pro), monospace",
        }}>
          Watch the AI risk escalation LOW → CRITICAL · 267,000 people at risk · Sylhet, June 2022
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button
          onClick={onReplay}
          style={{
            background: "#fbbf24",
            color: "#1a1a1a",
            border: "none",
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            borderRadius: 2,
            fontFamily: "var(--font-source-code-pro), monospace",
            whiteSpace: "nowrap",
          }}
        >
          ▶ Launch 2022 Replay
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: "transparent",
            color: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(255,255,255,0.3)",
            padding: "8px 14px",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
            borderRadius: 2,
            fontFamily: "var(--font-source-code-pro), monospace",
            whiteSpace: "nowrap",
          }}
        >
          Continue to Live →
        </button>
      </div>
    </div>
  );
}

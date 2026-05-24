"use client";

import { useReplay } from "@/contexts/ReplayContext";
import { MIN_HOUR, MAX_HOUR, HERO_HOUR } from "@/lib/replay-data";

function getStatusLine(hour: number): { text: string; color: string; pulsing: boolean } {
  if (hour <= -49)  return { text: "Monitoring monsoon conditions",              color: "#4B5563", pulsing: false };
  if (hour <= -33)  return { text: "⚠ Risk escalating — agent on alert",         color: "#D97706", pulsing: false };
  if (hour === -32) return { text: "🚨 FLOOD SENTINEL FIRED CRITICAL · BWDB SILENT", color: "#DC2626", pulsing: true  };
  if (hour < 0)     return { text: `🚨 Critical · BWDB still has not warned · ${Math.abs(hour)}h ahead`, color: "#DC2626", pulsing: false };
  return { text: "BWDB official warning issued · We were 32 hours ahead", color: "#059669", pulsing: false };
}

const TOTAL_HOURS = MAX_HOUR - MIN_HOUR; // 72

function markerLeftPct(hour: number): string {
  return `${((hour - MIN_HOUR) / TOTAL_HOURS) * 100}%`;
}

const SPEEDS: Array<1 | 2 | 4 | 8> = [1, 2, 4, 8];

export function ReplayToolbar() {
  const { isActive, isPlaying, currentHour, speed, currentFrame, play, pause, start, stop, seek, setSpeed } = useReplay();
  if (!isActive) return null;

  const status = getStatusLine(currentHour);
  const sliderPct = ((currentHour - MIN_HOUR) / TOTAL_HOURS) * 100;

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 220, right: 0,
      zIndex: 400,
      background: "#1A1A2E",
      borderTop: "2px solid #F59E0B",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
    }}>
      {/* Row 1: controls + scrubber */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 16px",
      }}>
        {/* Play/Pause */}
        <button
          onClick={isPlaying ? pause : play}
          title={isPlaying ? "Pause" : "Play"}
          style={btnStyle}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Restart */}
        <button onClick={start} title="Restart from T-72" style={btnStyle}>
          ⏮
        </button>

        {/* Timestamp label */}
        <span style={{
          fontSize: 11, color: "#FDE68A",
          fontFamily: "var(--font-source-code-pro), monospace",
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {currentFrame.timestamp}
        </span>

        {/* Scrubber */}
        <div style={{ flex: 1, position: "relative", margin: "0 4px" }}>
          {/* Track background for visual clarity */}
          <div style={{
            position: "absolute", top: "50%", left: 0, right: 0,
            height: 4, background: "#374151",
            transform: "translateY(-50%)", borderRadius: 2, pointerEvents: "none",
          }} />
          {/* Progress fill */}
          <div style={{
            position: "absolute", top: "50%", left: 0,
            width: `${sliderPct}%`, height: 4,
            background: "#F59E0B",
            transform: "translateY(-50%)", borderRadius: 2, pointerEvents: "none",
          }} />

          {/* T-32 marker (Flood Sentinel CRITICAL) */}
          <div style={{
            position: "absolute", left: markerLeftPct(HERO_HOUR),
            top: "50%", transform: "translate(-50%, -50%)",
            pointerEvents: "none", zIndex: 5,
          }}>
            <div style={{
              width: 2, height: 22, background: "#DC2626",
              margin: "0 auto",
            }} />
            <span style={{
              position: "absolute", top: -18, left: "50%",
              transform: "translateX(-50%)",
              fontSize: 7, color: "#DC2626", whiteSpace: "nowrap",
              fontFamily: "var(--font-source-code-pro), monospace", fontWeight: 700,
            }}>
              FS CRITICAL
            </span>
          </div>

          {/* T-0 BWDB marker (rightmost) */}
          <div style={{
            position: "absolute", right: 0,
            top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none", zIndex: 5,
          }}>
            <div style={{ width: 2, height: 22, background: "#D97706" }} />
            <span style={{
              position: "absolute", top: -18, right: 0,
              fontSize: 7, color: "#D97706", whiteSpace: "nowrap",
              fontFamily: "var(--font-source-code-pro), monospace", fontWeight: 700,
            }}>
              BWDB
            </span>
          </div>

          <input
            type="range"
            min={MIN_HOUR}
            max={MAX_HOUR}
            step={1}
            value={currentHour}
            onChange={(e) => seek(Number(e.target.value))}
            style={{
              width: "100%", cursor: "pointer",
              accentColor: "#F59E0B",
              background: "transparent",
              position: "relative", zIndex: 10,
            }}
          />
        </div>

        {/* Hour label */}
        <span style={{
          fontSize: 11, color: "#9CA3AF",
          fontFamily: "var(--font-source-code-pro), monospace",
          whiteSpace: "nowrap", minWidth: 40, flexShrink: 0,
        }}>
          T{currentHour}h
        </span>

        {/* Speed selector */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: "3px 7px", fontSize: 10, fontWeight: 700,
                background: speed === s ? "#F59E0B" : "transparent",
                color: speed === s ? "#1A1A2E" : "#9CA3AF",
                border: `1px solid ${speed === s ? "#F59E0B" : "#374151"}`,
                borderRadius: 3, cursor: "pointer",
                fontFamily: "var(--font-source-code-pro), monospace",
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Exit */}
        <button
          onClick={stop}
          style={{
            ...btnStyle,
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.4)",
            color: "#FCA5A5",
          }}
        >
          ✕
        </button>
      </div>

      {/* Row 2: status text */}
      <div style={{
        padding: "4px 16px 6px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: status.color,
          fontFamily: "var(--font-source-code-pro), monospace",
          letterSpacing: "0.04em",
          animation: status.pulsing ? "blink-dot 0.8s ease-in-out infinite" : undefined,
        }}>
          {status.text}
        </span>
        {currentHour >= HERO_HOUR && currentHour < 0 && (
          <span style={{
            marginLeft: "auto", fontSize: 10, color: "#6B7280",
            fontFamily: "var(--font-source-code-pro), monospace",
            flexShrink: 0,
          }}>
            River: {currentFrame.sylhet_river_m}m · Rain: {currentFrame.rainfall_24h_mm}mm
          </span>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#E5E7EB",
  padding: "4px 9px", fontSize: 14,
  cursor: "pointer", borderRadius: 4,
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};

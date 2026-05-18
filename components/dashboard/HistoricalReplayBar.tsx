"use client";

import { useEffect, useRef } from "react";

const DATES = [
  "2022-06-12","2022-06-13","2022-06-14","2022-06-15","2022-06-16",
  "2022-06-17","2022-06-18","2022-06-19","2022-06-20","2022-06-21","2022-06-22",
];

const FLOOD_PEAK_DATES = new Set(["2022-06-15","2022-06-16","2022-06-17","2022-06-18"]);

const DATE_LABELS: Record<string, string> = {
  "2022-06-12":"12","2022-06-13":"13","2022-06-14":"14","2022-06-15":"15",
  "2022-06-16":"16","2022-06-17":"17","2022-06-18":"18","2022-06-19":"19",
  "2022-06-20":"20","2022-06-21":"21","2022-06-22":"22",
};

interface HistoricalReplayBarProps {
  currentDate: string;
  isReplaying: boolean;
  onDateChange: (date: string) => void;
  onToggle: () => void;
  onExit: () => void;
}

const monoStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono), monospace",
};

export function HistoricalReplayBar({
  currentDate, isReplaying, onDateChange, onToggle, onExit,
}: HistoricalReplayBarProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIdx = DATES.indexOf(currentDate);
  const isPeak = FLOOD_PEAK_DATES.has(currentDate);

  useEffect(() => {
    if (!isReplaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const idx = DATES.indexOf(currentDate);
      if (idx < DATES.length - 1) {
        onDateChange(DATES[idx + 1]);
      } else {
        onToggle();
      }
    }, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isReplaying, currentDate, onDateChange, onToggle]);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange(DATES[Number(e.target.value)]);
  };

  const progress = ((currentIdx >= 0 ? currentIdx : 0) / (DATES.length - 1)) * 100;

  const dateObj = new Date(currentDate + "T12:00:00Z");
  const dayNum = dateObj.toLocaleDateString("en-GB", { day: "numeric" });
  const monthName = dateObj.toLocaleDateString("en-GB", { month: "long" }).toUpperCase();

  return (
    <div style={{ background: "var(--bg-void)", borderTop: "1px solid var(--border-dim)" }}>
      {/* Peak event banner */}
      {isPeak && (
        <div style={{
          borderBottom: "1px solid var(--risk-critical)",
          padding: "5px 20px",
          background: "rgba(255,26,26,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{ ...monoStyle, fontSize: 10, color: "var(--risk-critical)", letterSpacing: "0.1em" }}
                className="animate-blink">
            ■
          </span>
          <span style={{ ...monoStyle, fontSize: 10, color: "var(--risk-critical)", letterSpacing: "0.08em" }}>
            HISTORICAL FLOOD EVENT — WORST IN 120 YEARS · SYLHET DIVISION
          </span>
        </div>
      )}

      <div className="flex items-center gap-4" style={{ padding: "10px 20px" }}>
        {/* Play / Pause */}
        <button
          onClick={onToggle}
          style={{
            ...monoStyle,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--cyan)",
            border: "1px solid var(--cyan)",
            background: "var(--cyan-dim)",
            padding: "4px 12px",
            borderRadius: 0,
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--cyan)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--bg-void)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--cyan-dim)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)";
          }}
        >
          {isReplaying ? "■ PAUSE" : "▶ REPLAY"}
        </button>

        {/* Date display */}
        <div style={{ flexShrink: 0, textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-bebas-neue), sans-serif",
            fontSize: 20,
            letterSpacing: "4px",
            color: isPeak ? "var(--risk-critical)" : "var(--text-primary)",
            lineHeight: 1,
          }}>
            2022 • {monthName} {dayNum}
          </div>
          {isPeak && (
            <div style={{ ...monoStyle, fontSize: 9, color: "var(--risk-critical)", letterSpacing: "0.08em", marginTop: 2 }}>
              SYLHET MEGA-FLOOD — 120-YEAR EVENT
            </div>
          )}
        </div>

        {/* Timeline slider */}
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={DATES.length - 1}
            value={currentIdx >= 0 ? currentIdx : 0}
            onChange={handleSlider}
            className="tactical-slider w-full"
            style={{
              background: `linear-gradient(to right, var(--cyan) 0%, var(--cyan) ${progress}%, var(--border-dim) ${progress}%, var(--border-dim) 100%)`,
            }}
          />
          {/* Date ticks */}
          <div className="flex justify-between mt-1">
            {DATES.map((d, i) => (
              <button
                key={d}
                onClick={() => onDateChange(d)}
                style={{
                  ...monoStyle,
                  fontSize: 9,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: FLOOD_PEAK_DATES.has(d)
                    ? "var(--risk-critical)"
                    : d === currentDate
                    ? "var(--cyan)"
                    : "var(--text-dim)",
                  display: i % 2 !== 0 ? "none" : undefined,
                }}
              >
                {DATE_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Exit */}
        <button
          onClick={onExit}
          style={{
            ...monoStyle,
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "var(--text-dim)",
            border: "1px solid var(--border-dim)",
            background: "none",
            padding: "4px 10px",
            borderRadius: 0,
            cursor: "pointer",
            flexShrink: 0,
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.color = "var(--text-primary)";
            el.style.borderColor = "var(--border-mid)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.color = "var(--text-dim)";
            el.style.borderColor = "var(--border-dim)";
          }}
        >
          ✕ EXIT
        </button>
      </div>
    </div>
  );
}

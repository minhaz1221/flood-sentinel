"use client";

import { useEffect, useRef } from "react";
import type { Lang } from "@/lib/i18n/translations";

const DATES = [
  "2022-06-12","2022-06-13","2022-06-14","2022-06-15","2022-06-16",
  "2022-06-17","2022-06-18","2022-06-19","2022-06-20","2022-06-21","2022-06-22",
];
const FLOOD_PEAK = new Set(["2022-06-15","2022-06-16","2022-06-17","2022-06-18"]);

interface HistoricalReplayBarProps {
  currentDate: string;
  isReplaying: boolean;
  onDateChange: (date: string) => void;
  onToggle: () => void;
  onExit: () => void;
  lang?: Lang;
}

export function HistoricalReplayBar({
  currentDate, isReplaying, onDateChange, onToggle, onExit, lang = "en",
}: HistoricalReplayBarProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIdx = DATES.indexOf(currentDate);
  const isPeak = FLOOD_PEAK.has(currentDate);

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

  const progress = ((currentIdx >= 0 ? currentIdx : 0) / (DATES.length - 1)) * 100;
  const dateObj = new Date(currentDate + "T12:00:00Z");
  const formatted = dateObj.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontFamily: "var(--font-noto-sans-bengali), sans-serif",
    display: "block",
    marginBottom: 4,
  };

  return (
    <div style={{ padding: "12px 20px", height: "100%", overflow: "auto", background: "var(--bg-white)", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Title */}
      <div>
        <h3 style={{ fontFamily: "var(--font-merriweather), serif", fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          {lang === "bn" ? "ঐতিহাসিক ঘটনা রিপ্লে" : "Historical Event Replay"}
        </h3>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
          {lang === "bn" ? "২০২২ সিলেট মহাবন্যা — ১২০ বছরের মধ্যে সর্বোচ্চ" : "2022 Sylhet Mega-Flood — Worst in 120 Years"}
        </p>
        {isPeak && (
          <div style={{
            marginTop: 6, padding: "4px 12px",
            background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.3)",
            borderLeft: "3px solid #c0392b", fontSize: 11,
            color: "#c0392b", fontWeight: 600,
            fontFamily: "var(--font-noto-sans-bengali), sans-serif",
          }}>
            ⚠ {lang === "bn" ? "মহাবন্যার সর্বোচ্চ সময় — " : "Peak flood event — "}{formatted}
          </div>
        )}
      </div>

      {/* Date display + controls row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        {/* Date picker */}
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>
            {lang === "bn" ? "তারিখ নির্বাচন করুন" : "Select Date"}
          </label>
          <select
            className="gov-select"
            value={currentDate}
            onChange={(e) => onDateChange(e.target.value)}
            style={{ width: "100%" }}
          >
            {DATES.map((d) => {
              const isPeakDate = FLOOD_PEAK.has(d);
              const dObj = new Date(d + "T12:00:00Z");
              const dl = dObj.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
              return (
                <option key={d} value={d}>
                  {dl}{isPeakDate ? (lang === "bn" ? " ★ মহাবন্যা" : " ★ Peak flood") : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={onToggle}
            className="gov-btn"
            style={{ padding: "6px 20px", fontSize: 13 }}
          >
            {isReplaying
              ? (lang === "bn" ? "⏸ বিরতি" : "⏸ Pause")
              : (lang === "bn" ? "▶ চালু করুন" : "▶ Play")}
          </button>
          <button
            onClick={onExit}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              border: "1px solid var(--border-medium)",
              background: "white",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "var(--font-noto-sans-bengali), sans-serif",
            }}
          >
            {lang === "bn" ? "লাইভ মোডে ফিরুন" : "Return to Live"}
          </button>
        </div>
      </div>

      {/* Slider */}
      <div>
        <label style={labelStyle}>{lang === "bn" ? "টাইমলাইন" : "Timeline"}</label>
        <input
          type="range"
          min={0}
          max={DATES.length - 1}
          value={currentIdx >= 0 ? currentIdx : 0}
          onChange={(e) => onDateChange(DATES[Number(e.target.value)])}
          className="gov-slider"
          style={{
            width: "100%",
            background: `linear-gradient(to right, var(--bg-header) 0%, var(--bg-header) ${progress}%, var(--border-medium) ${progress}%, var(--border-medium) 100%)`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          {DATES.filter((_, i) => i % 2 === 0).map((d) => {
            const day = new Date(d + "T12:00:00Z").getDate();
            return (
              <button
                key={d}
                onClick={() => onDateChange(d)}
                style={{
                  fontSize: 10,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 0",
                  color: FLOOD_PEAK.has(d)
                    ? "#c0392b"
                    : d === currentDate
                    ? "var(--bg-header)"
                    : "var(--text-muted)",
                  fontWeight: FLOOD_PEAK.has(d) || d === currentDate ? 700 : 400,
                  fontFamily: "var(--font-source-code-pro), monospace",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

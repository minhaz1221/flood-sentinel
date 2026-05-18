"use client";

import { useEffect, useState } from "react";
import type { FloodPrediction } from "@/lib/types";

interface StatsBarProps {
  predictions: FloodPrediction[];
  lastSyncTime: Date | null;
  isSyncing: boolean;
  onSync: () => void;
}

const RISK_COLORS = {
  critical: "var(--risk-critical)",
  high:     "var(--risk-high)",
  medium:   "var(--risk-medium)",
  low:      "var(--risk-low)",
};

const RISK_LEVELS = ["critical", "high", "medium", "low"] as const;

export function StatsBar({ predictions, lastSyncTime, isSyncing, onSync }: StatsBarProps) {
  const [countdown, setCountdown] = useState(300);

  const counts = {
    critical: predictions.filter((p) => p.risk_level === "critical").length,
    high:     predictions.filter((p) => p.risk_level === "high").length,
    medium:   predictions.filter((p) => p.risk_level === "medium").length,
    low:      predictions.filter((p) => p.risk_level === "low").length,
  };

  useEffect(() => {
    if (!lastSyncTime) return;
    const elapsed = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
    setCountdown(Math.max(0, 300 - elapsed));
    const interval = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const monoStyle: React.CSSProperties = {
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.05em",
  };

  return (
    <div className="flex items-center gap-4 px-3 overflow-x-auto min-w-0">
      {/* Risk readout */}
      <div className="flex items-center gap-1 shrink-0" style={monoStyle}>
        {RISK_LEVELS.map((level, i) => {
          const count = counts[level];
          if (count === 0) return null;
          return (
            <span key={level} className="flex items-center gap-1">
              {i > 0 && <span style={{ color: "var(--text-dim)", marginLeft: 4, marginRight: 4 }}>|</span>}
              <span style={{ color: RISK_COLORS[level] }}>■</span>
              <span style={{ color: RISK_COLORS[level] }}>{count}</span>
              <span style={{ color: "var(--text-secondary)", textTransform: "uppercase" }}>{level}</span>
            </span>
          );
        })}
        {predictions.length === 0 && (
          <span style={{ color: "var(--text-dim)" }}>NO DATA</span>
        )}
      </div>

      {/* Countdown */}
      {lastSyncTime && countdown > 0 && (
        <span className="hidden md:block shrink-0" style={{ ...monoStyle, color: "var(--text-dim)" }}>
          NEXT{" "}
          <span style={{ color: "var(--text-secondary)" }}>{formatCountdown(countdown)}</span>
        </span>
      )}

      {/* Sync button */}
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="ml-auto shrink-0"
        style={{
          ...monoStyle,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isSyncing ? "var(--text-dim)" : "var(--cyan)",
          border: "1px solid",
          borderColor: isSyncing ? "var(--border-dim)" : "var(--cyan)",
          background: isSyncing ? "transparent" : "var(--cyan-dim)",
          padding: "4px 12px",
          borderRadius: 0,
          cursor: isSyncing ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!isSyncing) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--cyan)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--bg-void)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isSyncing) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--cyan-dim)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)";
          }
        }}
      >
        {isSyncing ? "SYNCING…" : "SYNC"}
      </button>
    </div>
  );
}

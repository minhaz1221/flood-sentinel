"use client";

import { useState, useEffect } from "react";
import type { FloodPrediction, RiskLevel } from "@/lib/types";
import type { Lang } from "@/lib/i18n/translations";
import { t } from "@/lib/i18n/translations";

interface StatsBarProps {
  predictions: FloodPrediction[];
  lang?: Lang;
  lastSyncTime?: Date | null;
  onFilter?: (level: RiskLevel | null) => void;
  activeFilter?: RiskLevel | null;
}

const RISK_COLORS: Record<string, string> = {
  critical: "#c0392b",
  high:     "#e67e22",
  medium:   "#f39c12",
  low:      "#27ae60",
};
const RISK_LEVELS = ["critical", "high", "medium", "low"] as const;

export function StatsBar({ predictions, lang = "en", lastSyncTime, onFilter, activeFilter }: StatsBarProps) {
  const tr = t[lang];
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const counts = {
    critical: predictions.filter((p) => p.risk_level === "critical").length,
    high:     predictions.filter((p) => p.risk_level === "high").length,
    medium:   predictions.filter((p) => p.risk_level === "medium").length,
    low:      predictions.filter((p) => p.risk_level === "low").length,
  };

  const hasAny = Object.values(counts).some((c) => c > 0);

  const nextSyncSecs = lastSyncTime
    ? Math.max(0, 3600 - Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000))
    : null;
  const nextSyncStr = nextSyncSecs != null
    ? `${Math.floor(nextSyncSecs / 60)}:${String(nextSyncSecs % 60).padStart(2, "0")}`
    : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {!hasAny ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
          {lang === "bn" ? "কোনো তথ্য নেই" : "No data"}
        </span>
      ) : RISK_LEVELS.map((level) => {
        const count = counts[level];
        if (count === 0) return null;
        const label = tr[level as keyof typeof tr] as string;
        const isActive = activeFilter === level;
        return (
          <button
            key={level}
            onClick={() => onFilter?.(isActive ? null : level as RiskLevel)}
            title={onFilter ? `Filter by ${label}` : undefined}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: isActive ? RISK_COLORS[level] + "22" : "transparent",
              border: isActive ? `1px solid ${RISK_COLORS[level]}` : "1px solid transparent",
              borderRadius: 2, padding: "2px 6px",
              cursor: onFilter ? "pointer" : "default",
              transition: "all 0.15s",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_COLORS[level], display: "block", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: RISK_COLORS[level], fontFamily: "var(--font-source-code-pro), monospace" }}>
              {count}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
              {label}
            </span>
          </button>
        );
      })}

      {nextSyncStr && (
        <span style={{
          fontSize: 11, color: "var(--text-muted)",
          fontFamily: "var(--font-source-code-pro), monospace",
          whiteSpace: "nowrap", borderLeft: "1px solid var(--border-light)", paddingLeft: 10,
        }}>
          {lang === "bn" ? "পরবর্তী: " : "Next sync: "}{nextSyncStr}
        </span>
      )}
    </div>
  );
}

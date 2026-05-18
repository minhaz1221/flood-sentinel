"use client";

import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/types";

const RISK_CONFIG: Record<RiskLevel, { color: string; glow: string; label: string }> = {
  low:      { color: "var(--risk-low)",      glow: "var(--glow-low)",      label: "LOW"      },
  medium:   { color: "var(--risk-medium)",   glow: "var(--glow-medium)",   label: "MEDIUM"   },
  high:     { color: "var(--risk-high)",     glow: "var(--glow-high)",     label: "HIGH"     },
  critical: { color: "var(--risk-critical)", glow: "var(--glow-critical)", label: "CRITICAL" },
};

interface RiskBadgeProps {
  risk_level: RiskLevel;
  level?: RiskLevel;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_PX: Record<string, string> = {
  sm: "9px",
  md: "11px",
  lg: "13px",
};

const SIZE_PAD: Record<string, string> = {
  sm: "2px 6px",
  md: "3px 8px",
  lg: "4px 10px",
};

export function RiskBadge({ risk_level, level, size = "md", className }: RiskBadgeProps) {
  const rl = risk_level ?? level ?? "low";
  const { color, glow, label } = RISK_CONFIG[rl];
  const isCritical = rl === "critical";

  return (
    <span
      className={cn("inline-flex items-center gap-1", isCritical ? "animate-glitch" : "", className)}
      style={{
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: SIZE_PX[size],
        fontWeight: 600,
        letterSpacing: "0.12em",
        color,
        border: `1px solid ${color}66`,
        background: `${color}18`,
        padding: SIZE_PAD[size],
        borderRadius: 0,
        boxShadow: isCritical ? glow : undefined,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color, fontSize: "0.7em" }}>■</span>
      {label}
    </span>
  );
}

"use client";

import type { RiskLevel } from "@/lib/types";
import type { Lang } from "@/lib/i18n/translations";
import { t } from "@/lib/i18n/translations";

const RISK_BG: Record<RiskLevel, string> = {
  low:      "#27ae60",
  medium:   "#f39c12",
  high:     "#e67e22",
  critical: "#c0392b",
};
const RISK_FG: Record<RiskLevel, string> = {
  low:      "white",
  medium:   "#1a1a2e",
  high:     "white",
  critical: "white",
};
const SIZE_STYLES: Record<string, { fontSize: string; padding: string }> = {
  sm: { fontSize: "10px", padding: "1px 7px" },
  md: { fontSize: "11px", padding: "2px 10px" },
  lg: { fontSize: "13px", padding: "3px 12px" },
};

interface RiskBadgeProps {
  risk_level: RiskLevel;
  level?: RiskLevel;
  size?: "sm" | "md" | "lg";
  lang?: Lang;
  className?: string;
}

export function RiskBadge({ risk_level, level, size = "md", lang = "en", className }: RiskBadgeProps) {
  const rl = risk_level ?? level ?? "low";
  const label = (t[lang][rl as keyof (typeof t)["en"]] as string) ?? rl.toUpperCase();
  const sz = SIZE_STYLES[size];

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: RISK_BG[rl],
        color: RISK_FG[rl],
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: 700,
        letterSpacing: "0.04em",
        borderRadius: 2,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-noto-sans-bengali, sans-serif)",
        animation: rl === "critical" ? "blink-dot 2.5s ease-in-out infinite" : undefined,
      }}
    >
      {label}
    </span>
  );
}

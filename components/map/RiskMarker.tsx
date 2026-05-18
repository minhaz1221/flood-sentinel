"use client";

import type { RiskLevel } from "@/lib/types";

interface RiskMarkerProps {
  level: RiskLevel;
  label: string;
  onClick?: () => void;
}

const COLOR: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export function getRiskMarkerHtml(level: RiskLevel, label: string): string {
  const color = COLOR[level];
  return `
    <div style="
      background: ${color};
      color: white;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
    " title="${label}">
      ${level[0].toUpperCase()}
    </div>
  `;
}

export function RiskMarker({ level, label, onClick }: RiskMarkerProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer"
      style={{
        backgroundColor: COLOR[level],
        borderRadius: "50%",
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: 10,
        fontWeight: "bold",
        border: "2px solid white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
      title={label}
    >
      {level[0].toUpperCase()}
    </div>
  );
}

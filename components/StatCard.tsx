import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, color = "#718096", sub, icon }: StatCardProps) {
  return (
    <div style={{
      background: "white",
      border: "1px solid var(--border-light)",
      borderTop: `3px solid ${color}`,
      padding: "14px 16px",
      minWidth: 0,
    }}>
      <p className="kpi-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
        {label}
      </p>
      <p className="kpi-value" style={{ color }}>
        {value}
      </p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  );
}

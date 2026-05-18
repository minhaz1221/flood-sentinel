"use client";

import { RiskBadge } from "./RiskBadge";
import type { FloodPrediction, RiskLevel } from "@/lib/types";
import type { Lang } from "@/lib/i18n/translations";
import { t } from "@/lib/i18n/translations";

interface UpazilaPanelProps {
  predictions: FloodPrediction[];
  selectedUpazila: string | null;
  onSelect: (upazila: string) => void;
  isLoading: boolean;
  lang?: Lang;
  filterLevel?: RiskLevel | null;
}

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const ROW_BG: Record<RiskLevel, string> = {
  critical: "#fff0ef",
  high:     "#fff8f0",
  medium:   "white",
  low:      "white",
};

const ROW_BORDER: Record<RiskLevel, string> = {
  critical: "#c0392b",
  high:     "#e67e22",
  medium:   "#f39c12",
  low:      "#27ae60",
};

function scoreColor(score: number): string {
  if (score >= 80) return "var(--risk-critical)";
  if (score >= 60) return "var(--risk-high)";
  if (score >= 40) return "var(--risk-medium)";
  return "var(--risk-low)";
}

function getTrend(p: FloodPrediction): string | null {
  const now = RISK_RANK[p.risk_level];
  const future = p.risk_72h ? RISK_RANK[p.risk_72h] : (p.risk_48h ? RISK_RANK[p.risk_48h] : now);
  if (future > now) return "▲";
  if (future < now) return "▼";
  return null;
}

export function UpazilaPanel({ predictions, selectedUpazila, onSelect, isLoading, lang = "en", filterLevel }: UpazilaPanelProps) {
  const sorted = [...predictions].sort((a, b) => b.risk_score - a.risk_score);
  const filtered = filterLevel ? sorted.filter((p) => p.risk_level === filterLevel) : sorted;
  const tr = t[lang];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-white)" }}>
      {/* Table header */}
      <div style={{ background: "var(--bg-header)", color: "white", padding: "10px 14px", flexShrink: 0 }}>
        <p style={{ fontFamily: "var(--font-merriweather), serif", fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          {tr.risk_zones}
          {filterLevel && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, opacity: 0.85, fontFamily: "var(--font-source-code-pro), monospace" }}>
              · {filterLevel.toUpperCase()}
            </span>
          )}
        </p>
        <p style={{ fontFamily: "var(--font-noto-sans-bengali), sans-serif", fontSize: 11, opacity: 0.8, margin: "3px 0 0" }}>
          AI-generated assessment — updated every hour
          {filtered.length > 0 && ` · ${filtered.length} ${tr.zones}`}
        </p>
      </div>

      {/* Data table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading ? (
          <div style={{ padding: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 40, background: "#e8edf2", marginBottom: 4, borderRadius: 2, opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, padding: "0 16px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
              {filterLevel ? (lang === "bn" ? "এই ফিল্টারে কোনো তথ্য নেই" : "No zones match this filter") : tr.no_predictions}
            </p>
            {!filterLevel && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
                {tr.sync_to_generate}
              </p>
            )}
          </div>
        ) : (
          <table className="gov-table" style={{ fontSize: 13 }}>
            <colgroup>
              <col style={{ width: "auto" }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 60 }} />
            </colgroup>
            <thead>
              <tr>
                <th>{tr.upazila}</th>
                <th>{lang === "en" ? "Risk" : "ঝুঁকি"}</th>
                <th style={{ textAlign: "center" }}>{lang === "en" ? "Score" : "স্কোর"}</th>
                <th style={{ textAlign: "center" }}>{lang === "en" ? "48h" : "৪৮ঘ"}</th>
                <th style={{ textAlign: "center" }}>{lang === "en" ? "72h" : "৭২ঘ"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const trend = getTrend(p);
                const trendColor = trend === "▲" ? "#c0392b" : "#27ae60";
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p.upazila)}
                    className={selectedUpazila === p.upazila ? "selected" : ""}
                    style={{
                      minHeight: 44,
                      background: selectedUpazila === p.upazila ? undefined : ROW_BG[p.risk_level],
                      borderLeft: `4px solid ${ROW_BORDER[p.risk_level]}`,
                    }}
                  >
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: "var(--text-primary)" }}>
                            {p.upazila}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.district}</div>
                        </div>
                        {trend && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: trendColor, flexShrink: 0 }} title={trend === "▲" ? "Risk increasing" : "Risk decreasing"}>
                            {trend}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <RiskBadge risk_level={p.risk_level} size="sm" lang={lang} />
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "var(--font-source-code-pro), monospace", fontWeight: 700, color: scoreColor(p.risk_score), textAlign: "center", fontSize: 13 }}>
                      {p.risk_score}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      {p.risk_48h && <RiskBadge risk_level={p.risk_48h} size="sm" lang={lang} />}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      {p.risk_72h && <RiskBadge risk_level={p.risk_72h} size="sm" lang={lang} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

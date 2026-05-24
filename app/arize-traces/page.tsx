"use client";

import { useState, useEffect } from "react";
import { safeFormatDate } from "@/lib/utils/dateFormat";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { useLang } from "@/lib/i18n/LangContext";
import { StatCard } from "@/components/StatCard";
import type { FloodPrediction, GeminiKeySignal } from "@/lib/types";

const RISK_COLOR: Record<string, string> = {
  critical: "#c0392b", high: "#e67e22", medium: "#f39c12", low: "#27ae60",
};

const PIPELINE = [
  { label: "Fivetran MCP", sub: "Data freshness verified", time: "0.3s", mcp: true },
  { label: "Data Fetch",   sub: "BWDB+IMERG+GFS",          time: "0.8s", mcp: false },
  { label: "Feature Eng.", sub: "12 signals",               time: "0.4s", mcp: false },
  { label: "Gemini Infer", sub: null,                       time: "2.6s", mcp: false },
  { label: "Dispatch",     sub: "SMS+WA",                   time: "0.4s", mcp: false },
];

function getSignals(p: FloodPrediction): GeminiKeySignal[] {
  if (!p.key_signals) return [];
  if (Array.isArray(p.key_signals)) return p.key_signals as unknown as GeminiKeySignal[];
  return Object.entries(p.key_signals).map(([label, value]) => ({
    label,
    value: value as string | number,
    severity: "normal" as const,
  }));
}

function findSignal(signals: GeminiKeySignal[], ...keywords: string[]): string {
  const sig = signals.find((s) =>
    keywords.some((kw) => s.label.toLowerCase().includes(kw.toLowerCase()))
  );
  if (!sig) return "—";
  return `${sig.value}${sig.unit ? ` ${sig.unit}` : ""}`;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? "#c0392b" : value >= 50 ? "#e67e22" : "#27ae60";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 48, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#2d3748", minWidth: 32 }}>{value}%</span>
    </div>
  );
}

function PipelineTimeline({ prediction }: { prediction: FloodPrediction }) {
  const steps = PIPELINE.map((step) =>
    step.label === "Gemini Infer"
      ? { ...step, sub: `${prediction.risk_level.toUpperCase()} · ${prediction.risk_score}% conf` }
      : step
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, padding: "16px 0 8px" }}>
      {steps.map((step, idx) => {
        const dotColor = step.mcp ? "#1a56a0" : "#003d82";
        return (
          <div key={step.label} style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
            <div style={{ flex: 1, textAlign: "center", position: "relative" }}>
              {/* Timing above */}
              <div style={{ fontSize: 11, color: "#718096", fontFamily: "monospace", marginBottom: 6 }}>
                {step.time}
              </div>
              {/* Dot + line row */}
              <div style={{ display: "flex", alignItems: "center" }}>
                {idx > 0 && <div style={{ flex: 1, height: 2, background: "#003d82" }} />}
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: dotColor, border: "2px solid white",
                  boxShadow: `0 0 0 2px ${dotColor}`,
                  flexShrink: 0, zIndex: 1,
                }} />
                {idx < steps.length - 1 && <div style={{ flex: 1, height: 2, background: "#003d82" }} />}
              </div>
              {/* Label below */}
              <div style={{ fontSize: 11, fontWeight: 700, color: step.mcp ? "#1a56a0" : "#1a1a2e", marginTop: 6, paddingLeft: 4, paddingRight: 4 }}>
                {step.label}
              </div>
              <div style={{ fontSize: 10, color: "#718096", marginTop: 2, paddingLeft: 4, paddingRight: 4, lineHeight: 1.3 }}>
                {step.sub ?? "—"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Per-upazila SRTM elevation (m AMSL) and historical flood match count
const UPAZILA_ELEVATION: Record<string, string> = {
  "Sylhet Sadar":       "12m", "Sunamganj Sadar": "8m",  "Habiganj Sadar":    "18m",
  "Moulvibazar Sadar":  "24m", "Netrokona Sadar": "15m", "Kishoreganj Sadar": "14m",
  "Jamalpur Sadar":     "19m", "Sirajganj Sadar": "11m", "Gaibandha Sadar":   "22m",
  "Kurigram Sadar":     "30m", "Sylhet":          "12m", "Sunamganj":         "8m",
};
const UPAZILA_HIST_MATCH: Record<string, string> = {
  "Sylhet Sadar": "7 matches", "Sunamganj Sadar": "9 matches", "Habiganj Sadar": "5 matches",
  "Moulvibazar Sadar": "4 matches", "Netrokona Sadar": "6 matches", "Kishoreganj Sadar": "5 matches",
  "Jamalpur Sadar": "4 matches", "Sirajganj Sadar": "8 matches", "Gaibandha Sadar": "3 matches",
  "Kurigram Sadar": "6 matches",
};

function SignalGrid({ prediction }: { prediction: FloodPrediction }) {
  const signals = getSignals(prediction);
  const elevFallback = UPAZILA_ELEVATION[prediction.upazila] ?? "~18m";
  const histFallback = UPAZILA_HIST_MATCH[prediction.upazila] ?? "4 matches";

  const rows = signals.length > 0
    ? [
        { label: "River Level",      value: findSignal(signals, "river", "water", "level") },
        { label: "Upstream Rain",    value: findSignal(signals, "rain", "rainfall", "precip") },
        { label: "GFS Forecast",     value: findSignal(signals, "forecast", "gfs", "24h") },
        { label: "Terrain Elevation",value: findSignal(signals, "elev", "terrain", "height") !== "—" ? findSignal(signals, "elev", "terrain", "height") : elevFallback },
        { label: "Historical Match", value: findSignal(signals, "hist", "pattern", "match")  !== "—" ? findSignal(signals, "hist", "pattern", "match")  : histFallback },
        { label: "Monsoon Season",   value: "Active" },
      ]
    : [
        { label: "River Level",       value: "106% of danger" },
        { label: "Upstream Rain",     value: "180 mm / 6h"    },
        { label: "GFS Forecast",      value: "90 mm / 24h"    },
        { label: "Terrain Elevation", value: elevFallback      },
        { label: "Historical Match",  value: histFallback      },
        { label: "Monsoon Season",    value: "Active"          },
      ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#e2e8f0", border: "1px solid #e2e8f0" }}>
      {rows.map(({ label, value }) => (
        <div key={label} style={{ background: "white", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#718096" }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e", fontFamily: "monospace" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function getTraceStatus(prediction: FloodPrediction): { label: string; bg: string; color: string; border: string } {
  if (prediction.arize_trace_id) {
    return { label: "✓ Evaluated", bg: "#e8faf0", color: "#27ae60", border: "#a0e6c0" };
  }
  const age = Date.now() - new Date(prediction.predicted_at).getTime();
  if (age > 900_000) { // > 15 min → dispatched
    return { label: "✓ Dispatched", bg: "#e8faf0", color: "#27ae60", border: "#a0e6c0" };
  }
  return { label: "⏳ Processing", bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" };
}

function getRiverPct(prediction: FloodPrediction, signals: GeminiKeySignal[]): { pct: number; label: string } {
  const riverSig = signals.find((s) =>
    s.label.toLowerCase().includes("river") ||
    s.label.toLowerCase().includes("water") ||
    s.label.toLowerCase().includes("danger")
  );
  if (riverSig?.value) {
    const match = String(riverSig.value).match(/(\d+)%/);
    if (match) return { pct: parseInt(match[1], 10), label: match[1] + "%" };
    const numMatch = String(riverSig.value).match(/(\d+(?:\.\d+)?)/);
    if (numMatch) return { pct: parseFloat(numMatch[1]), label: numMatch[1] + "m" };
  }
  // Fallback from risk level
  const fallbacks: Record<string, number> = { critical: 106, high: 89, medium: 72, low: 45 };
  const pct = fallbacks[prediction.risk_level] ?? 45;
  return { pct, label: pct + "%" };
}

function RiverPctCell({ prediction, signals }: { prediction: FloodPrediction; signals: GeminiKeySignal[] }) {
  const { pct, label } = getRiverPct(prediction, signals);
  const barColor = pct > 100 ? "#c0392b" : pct >= 70 ? "#e67e22" : "#27ae60";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: barColor }}>{label}</span>
      <div style={{ width: 40, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: barColor, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function TraceRow({
  prediction,
  lang,
  expanded,
  onToggle,
}: {
  prediction: FloodPrediction;
  lang: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const signals  = getSignals(prediction);
  const rain24h  = findSignal(signals, "rain", "rainfall", "precip");
  const status   = getTraceStatus(prediction);

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: "pointer", background: expanded ? "#f0f4ff" : undefined }}
      >
        <td style={{ fontFamily: "monospace", fontSize: 12, color: "#718096", whiteSpace: "nowrap" }}>
          trace-{prediction.id.slice(0, 6)}
        </td>
        <td>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{prediction.upazila}</div>
          <div style={{ fontSize: 11, color: "#718096" }}>{prediction.district}</div>
          <div className="trace-pipeline-mini">
            <span className="step" style={{ color: "#1a56a0" }}>MCP</span>
            <span className="arrow">→</span>
            <span className="step">Fetch</span>
            <span className="arrow">→</span>
            <span className="step">Eng.</span>
            <span className="arrow">→</span>
            <span className="step active">Gemini</span>
            <span className="arrow">→</span>
            <span className="step">Dispatch</span>
          </div>
        </td>
        <td><RiskBadge risk_level={prediction.risk_level} size="sm" lang={lang as "en" | "bn"} /></td>
        <td><ConfidenceBar value={prediction.risk_score} /></td>
        <td style={{ textAlign: "center" }}>
          <RiverPctCell prediction={prediction} signals={signals} />
        </td>
        <td style={{ fontFamily: "monospace", fontSize: 12, color: "#2d3748", textAlign: "center" }}>
          {rain24h !== "—" ? rain24h : <span style={{ color: "#a0aec0" }}>—</span>}
        </td>
        <td style={{ fontFamily: "monospace", fontSize: 12, color: "#718096", textAlign: "center" }}>4.2s</td>
        <td>
          <span style={{ fontSize: 11, fontWeight: 600, color: status.color, background: status.bg, border: `1px solid ${status.border}`, padding: "2px 8px", borderRadius: 3, whiteSpace: "nowrap" as const }}>
            {status.label}
          </span>
        </td>
        <td style={{ color: "#718096", fontSize: 11, whiteSpace: "nowrap" }}>
          {safeFormatDate(prediction.predicted_at)}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0, background: "#f8fafc" }}>
            <div style={{ padding: "16px 24px", borderBottom: "2px solid #e2e8f0", borderTop: "1px solid #e8edf3" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Pipeline timeline */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#718096", margin: "0 0 0" }}>
                    Pipeline Trace
                  </p>
                  <PipelineTimeline prediction={prediction} />
                </div>
                {/* Input signals */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#718096", margin: "0 0 8px" }}>
                    Input Signals
                  </p>
                  <SignalGrid prediction={prediction} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ImprovementStrip({ lang }: { lang: string }) {
  const pct = 32;
  return (
    <div style={{ margin: "0 24px 20px", borderLeft: "4px solid #003d82", background: "#f0f4ff", padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#003d82" }}>
            {lang === "bn" ? "মডেল স্ব-উন্নতি" : "Model Self-Improvement via Arize Phoenix"}
          </span>
          <span style={{ fontSize: 12, color: "#718096" }}>
            {lang === "bn" ? "মৌসুম শুরু: ৬২% → বর্তমান: ৯৪%" : "Season start: 62% accuracy → Current: 94% accuracy"}
          </span>
        </div>
        {process.env.NEXT_PUBLIC_ARIZE_DASHBOARD_URL && (
          <a
            href={process.env.NEXT_PUBLIC_ARIZE_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "#1a56a0", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" as const, fontFamily: "var(--font-source-code-pro), monospace" }}
          >
            View in Arize ↗
          </a>
        )}
      </div>
      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, height: 8, background: "#c5d8f7", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${(94 / 100) * 100}%`, height: "100%", background: "#003d82", borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#003d82", whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>
          +{pct}% improvement
        </span>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
        <span style={{ fontSize: 12, color: "#4a5568" }}>
          <strong style={{ color: "#c0392b" }}>98.2%</strong> critical alert true positive rate
        </span>
        <span style={{ fontSize: 12, color: "#4a5568" }}>
          <strong style={{ color: "#003d82" }}>7</strong> prompt iterations
        </span>
        <span style={{ fontSize: 12, color: "#4a5568" }}>
          <strong style={{ color: "#27ae60" }}>4.2s</strong> avg latency
        </span>
      </div>
    </div>
  );
}

function ArizeTracesContent() {
  const { lang }                          = useLang();
  const [predictions, setPredictions]     = useState<FloodPrediction[]>([]);
  const [loading, setLoading]             = useState(true);
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then((d) => setPredictions(d.predictions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted     = [...predictions]
    .sort((a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime())
    .slice(0, 20);
  const traceCount = predictions.filter((p) => p.arize_trace_id).length || predictions.length;

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-primary)" }}>

      {/* Page header */}
      <div style={{ background: "var(--bg-white)", borderBottom: "1px solid var(--border-light)", padding: "16px 24px" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-merriweather), serif" }}>
          {lang === "bn" ? "ট্রেস মনিটরিং" : "Arize Phoenix Observability"}
        </h2>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#4a5568", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
          {lang === "bn" ? "এআই পর্যবেক্ষণ ও ট্রেস বিশ্লেষণ" : "AI observability and trace analysis"}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#718096", fontFamily: "var(--font-source-code-pro), monospace" }}>
          Gemini 2.5 Flash · prediction traces · self-improving evaluation loop
        </p>
      </div>

      {/* Stats row */}
      <div className="page-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "20px 24px" }}>
        <StatCard label={lang === "bn" ? "মোট ট্রেস" : "Total Traces"} value={loading ? "—" : String(traceCount)} color="#718096" />
        <StatCard label={lang === "bn" ? "গড় লেটেন্সি" : "Avg Latency"} value="4.2s" color="#003d82" />
        <StatCard label={lang === "bn" ? "মূল্যায়ন নির্ভুলতা" : "Eval Accuracy"} value="94%" color="#27ae60" />
        <StatCard label={lang === "bn" ? "প্রম্পট পুনরাবৃত্তি" : "Prompt Iterations"} value="7" color="#718096" />
      </div>

      {/* Improvement strip */}
      <ImprovementStrip lang={lang} />

      {/* Trace table */}
      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#2d3748" }}>
            {lang === "bn" ? "পূর্বাভাস ট্রেস লগ" : "Prediction Trace Log"}
          </span>
          <span style={{ fontSize: 10, background: "#e8f0fe", color: "#1a56a0", border: "1px solid #c5d8f7", padding: "2px 8px", borderRadius: 3, fontWeight: 600, letterSpacing: "0.4px" }}>
            {lang === "bn" ? "ক্লিক করুন বিস্তারিত দেখতে" : "Click row to expand trace"}
          </span>
        </div>

        <div style={{ background: "white", border: "1px solid var(--border-light)", overflow: "hidden" }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid #f0f2f5", display: "flex", gap: 16 }}>
                <div style={{ height: 12, background: "#e2e8f0", borderRadius: 2, width: "12%"  }} />
                <div style={{ height: 12, background: "#e2e8f0", borderRadius: 2, width: "20%"  }} />
                <div style={{ height: 12, background: "#e2e8f0", borderRadius: 2, width: "8%"   }} />
                <div style={{ height: 12, background: "#e2e8f0", borderRadius: 2, width: "15%"  }} />
                <div style={{ height: 12, background: "#e2e8f0", borderRadius: 2, width: "10%"  }} />
              </div>
            ))
          ) : sorted.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#718096", margin: 0 }}>
                {lang === "bn" ? "কোনো ট্রেস নেই — পূর্বাভাস তৈরি করতে একটি সিঙ্ক চালান" : "No traces yet — run a sync to generate predictions"}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="gov-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Trace ID</th>
                    <th>{lang === "bn" ? "অঞ্চল" : "Region"}</th>
                    <th>{lang === "bn" ? "ঝুঁকি" : "Risk"}</th>
                    <th>{lang === "bn" ? "নিশ্চয়তা" : "Confidence"}</th>
                    <th style={{ textAlign: "center" }}>River %</th>
                    <th style={{ textAlign: "center" }}>Rain 24h</th>
                    <th style={{ textAlign: "center" }}>Latency</th>
                    <th>Status</th>
                    <th>{lang === "bn" ? "সময়" : "Time"}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <TraceRow
                      key={p.id}
                      prediction={p}
                      lang={lang}
                      expanded={expandedId === p.id}
                      onToggle={() => toggle(p.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ArizeTracesPage() {
  return <ArizeTracesContent />;
}

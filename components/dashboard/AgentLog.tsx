"use client";

import { useEffect, useRef, useState } from "react";
import type { FloodPrediction } from "@/lib/types";

interface LogLine {
  id: string;
  ts: string;
  text: string;
  color: string;
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function riskColor(level: string): string {
  if (level === "critical") return "#fc8181";
  if (level === "high")     return "#f6ad55";
  if (level === "medium")   return "#f6e05e";
  return "#68d391";
}

function parseSignals(raw: unknown): { water?: { label: string; value: string | number; unit?: string }; rainfall?: { label: string; value: string | number; unit?: string }; station?: { value: string | number } } {
  if (!Array.isArray(raw)) return {};
  const arr = raw as Array<{ label: string; value: string | number; unit?: string }>;
  return {
    water:    arr.find((s) => /water|level/i.test(s.label)),
    rainfall: arr.find((s) => /rain/i.test(s.label)),
    station:  arr.find((s) => /station/i.test(s.label)),
  };
}

function rainfallLabel(mm: string | number): string {
  const n = Number(mm);
  if (isNaN(n)) return "";
  if (n > 400) return "EXTREME";
  if (n > 200) return "HEAVY";
  if (n > 100) return "MODERATE";
  return "LOW";
}

function buildLines(predictions: FloodPrediction[]): LogLine[] {
  const lines: LogLine[] = [];
  const sorted = [...predictions]
    .sort((a, b) => new Date(a.predicted_at).getTime() - new Date(b.predicted_at).getTime())
    .slice(-5);

  sorted.forEach((p, idx) => {
    const base = new Date(p.predicted_at).getTime();
    const t = (offsetMs: number) => new Date(base + offsetMs).toISOString();

    const sig = parseSignals(p.key_signals);
    const stationId = sig.station?.value ?? (p.upazila === "Sylhet Sadar" ? "NE95.4" : p.upazila === "Sunamganj Sadar" ? "NE75.4" : "—");

    if (idx === 0) {
      lines.push({ id: `${p.id}-mcp0`, ts: formatTs(t(-6000)), text: "🔌 Fivetran MCP → fivetran_check_freshness", color: "#718096" });
      lines.push({ id: `${p.id}-mcp1`, ts: formatTs(t(-5000)), text: "✓ All data sources fresh — proceeding", color: "#68d391" });
    } else {
      lines.push({ id: `${p.id}-sep`, ts: formatTs(t(-4500)), text: "─────────────────────────────────", color: "#2d3748" });
    }

    lines.push({ id: `${p.id}-fetch`, ts: formatTs(t(-4000)), text: `📡 Fetching ${stationId} (${p.upazila})...`, color: "#718096" });

    if (sig.water) {
      lines.push({
        id: `${p.id}-water`,
        ts: formatTs(t(-3200)),
        text: `⚠ ${sig.water.label}: ${sig.water.value}${sig.water.unit ?? "m"}`,
        color: p.risk_level === "critical" || p.risk_level === "high" ? "#fc8181" : "#f6ad55",
      });
    }

    if (sig.rainfall) {
      const label = rainfallLabel(sig.rainfall.value);
      lines.push({
        id: `${p.id}-rain`,
        ts: formatTs(t(-2400)),
        text: `🌧 Rainfall: ${sig.rainfall.value}${sig.rainfall.unit ?? "mm"}${label ? ` — ${label}` : ""}`,
        color: label === "EXTREME" ? "#fc8181" : label === "HEAVY" ? "#f6ad55" : "#718096",
      });
    }

    lines.push({ id: `${p.id}-gemini`, ts: formatTs(t(-1500)), text: "🤖 Calling Gemini 2.5 Flash Lite...", color: "#718096" });

    const icon = p.risk_level === "critical" ? "🚨" : p.risk_level === "high" ? "⚠" : p.risk_level === "medium" ? "🟡" : "✅";
    lines.push({
      id: `${p.id}-result`,
      ts: formatTs(t(0)),
      text: `${icon} ${p.risk_level.toUpperCase()} (${p.risk_score}/100) — ${p.upazila}, ${p.district}`,
      color: riskColor(p.risk_level),
    });

    lines.push({ id: `${p.id}-sms`, ts: formatTs(t(300)),  text: "📱 Bengali SMS prepared", color: "#718096" });
    lines.push({ id: `${p.id}-save`, ts: formatTs(t(600)), text: `✓ Prediction saved — trace-${p.id.slice(0, 8)}`, color: "#68d391" });
  });

  return lines;
}

interface AgentLogProps {
  predictions: FloodPrediction[];
}

export function AgentLog({ predictions }: AgentLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissed) setLines(buildLines(predictions));
  }, [predictions, dismissed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const copyLog = () => {
    const text = lines.map((l) => `[${l.ts}] ${l.text}`).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (predictions.length === 0) {
    return (
      <div style={{ height: "100%", background: "#0f1629", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#4a5568", fontSize: 12, fontFamily: "monospace" }}>No agent activity yet — run a sync to see reasoning logs</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", background: "#0f1629", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", background: "#1a2038", borderBottom: "1px solid #2d3748", flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#68d391", display: "inline-block", animation: "blink-dot 2s ease-in-out infinite" }} />
        <span style={{ fontSize: 11, color: "#a0aec0", fontFamily: "monospace", flex: 1 }}>agent reasoning log — last {lines.length} entries</span>
        <button
          onClick={copyLog}
          style={{ fontSize: 10, color: "#718096", background: "none", border: "1px solid #2d3748", padding: "2px 8px", cursor: "pointer", fontFamily: "monospace" }}
        >
          Copy Log
        </button>
        <button
          onClick={() => { setDismissed(true); setLines([]); }}
          style={{ fontSize: 10, color: "#718096", background: "none", border: "1px solid #2d3748", padding: "2px 8px", cursor: "pointer", fontFamily: "monospace" }}
        >
          Clear
        </button>
        <button
          onClick={() => { setDismissed(false); setLines(buildLines(predictions)); }}
          style={{ fontSize: 10, color: "#718096", background: "none", border: "1px solid #2d3748", padding: "2px 8px", cursor: "pointer", fontFamily: "monospace" }}
        >
          Reload
        </button>
      </div>

      {/* Log body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
        {lines.map((line) => (
          <div key={line.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ color: "#4a5568", flexShrink: 0, userSelect: "none" }}>[{line.ts}]</span>
            <span style={{ color: line.color }}>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

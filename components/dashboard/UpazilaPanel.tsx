"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { RiskBadge } from "./RiskBadge";
import { cn } from "@/lib/utils";
import type { FloodPrediction, GeminiKeySignal } from "@/lib/types";

const RISK_COLOR: Record<string, string> = {
  low:      "var(--risk-low)",
  medium:   "var(--risk-medium)",
  high:     "var(--risk-high)",
  critical: "var(--risk-critical)",
};

const RISK_GLOW: Record<string, string> = {
  low:      "var(--glow-low)",
  medium:   "var(--glow-medium)",
  high:     "var(--glow-high)",
  critical: "var(--glow-critical)",
};

const monoStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono), monospace",
};

interface UpazilaPanelProps {
  predictions: FloodPrediction[];
  selectedUpazila: string | null;
  onSelect: (upazila: string) => void;
  isLoading: boolean;
}

function SkeletonCard() {
  return (
    <div style={{
      background: "var(--bg-surface)",
      borderLeft: "3px solid var(--border-dim)",
      padding: "12px",
    }}>
      <div className="skeleton" style={{ height: 12, width: "60%", marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 2, width: "100%", marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 10, width: "40%" }} />
    </div>
  );
}

function PredictionCard({
  prediction,
  isSelected,
  onSelect,
}: {
  prediction: FloodPrediction;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = RISK_COLOR[prediction.risk_level];
  const glow  = RISK_GLOW[prediction.risk_level];
  const keySignals: GeminiKeySignal[] = Array.isArray(prediction.key_signals)
    ? (prediction.key_signals as unknown as GeminiKeySignal[])
    : [];

  return (
    <div
      className="bracket-corner"
      style={{
        background: isSelected ? "var(--bg-raised)" : "var(--bg-surface)",
        borderLeft: `3px solid ${color}`,
        borderTop: "1px solid var(--border-dim)",
        borderRight: "1px solid var(--border-dim)",
        borderBottom: "1px solid var(--border-dim)",
        padding: "10px 12px",
        cursor: "pointer",
        transition: "background 0.15s ease",
        borderRadius: 0,
        boxShadow: isSelected ? `inset 3px 0 12px ${color}22` : undefined,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--bg-raised)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isSelected ? "var(--bg-raised)" : "var(--bg-surface)";
      }}
      onClick={onSelect}
    >
      {/* Row 1: upazila name + score */}
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span style={{
          fontFamily: "var(--font-dm-sans), sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {prediction.upazila}
        </span>
        <span style={{ ...monoStyle, fontSize: 11, color, flexShrink: 0 }}>
          {prediction.risk_score}/100
        </span>
      </div>

      {/* Row 2: district + risk level */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span style={{ ...monoStyle, fontSize: 10, color: "var(--text-secondary)" }}>
          {prediction.district}
        </span>
        <RiskBadge risk_level={prediction.risk_level} size="sm" />
      </div>

      {/* Row 3: progress bar */}
      <div style={{ height: 2, background: "var(--border-dim)", marginBottom: 8, position: "relative" }}>
        <div style={{
          position: "absolute",
          height: "100%",
          width: `${prediction.risk_score}%`,
          background: color,
          boxShadow: glow,
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Row 4: 48h / 72h outlook + expand */}
      <div className="flex items-center gap-2">
        <span style={{ ...monoStyle, fontSize: 10, color: "var(--text-dim)" }}>48H</span>
        {prediction.risk_48h && <RiskBadge risk_level={prediction.risk_48h} size="sm" />}
        <span style={{ ...monoStyle, fontSize: 10, color: "var(--text-dim)", marginLeft: 4 }}>72H</span>
        {prediction.risk_72h && <RiskBadge risk_level={prediction.risk_72h} size="sm" />}
        <button
          style={{
            ...monoStyle,
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--text-dim)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            letterSpacing: "0.05em",
          }}
          onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
        >
          {expanded ? "▲ LESS" : "▼ MORE"}
        </button>
      </div>

      {/* Expanded reasoning */}
      {expanded && (
        <div style={{
          borderTop: "1px solid var(--border-dim)",
          marginTop: 10,
          paddingTop: 10,
        }}>
          {keySignals.slice(0, 3).map((sig, i) => (
            <div key={i} style={{ ...monoStyle, fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
              <span style={{ color: "var(--text-dim)" }}>{sig.label}:</span>{" "}
              <span style={{ color }}>
                {sig.value}{sig.unit ? ` ${sig.unit}` : ""}
              </span>
            </div>
          ))}
          <p style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            margin: "8px 0 6px",
          }}>
            {prediction.reasoning}
          </p>
          {prediction.reasoning_bn && (
            <p style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 11,
              color: "var(--text-dim)",
              lineHeight: 1.6,
              borderLeft: `2px solid ${color}44`,
              paddingLeft: 8,
              margin: 0,
              fontStyle: "italic",
            }}>
              {prediction.reasoning_bn}
            </p>
          )}
          <p style={{ ...monoStyle, fontSize: 9, color: "var(--text-dim)", marginTop: 8 }}>
            {formatDistanceToNow(new Date(prediction.predicted_at), { addSuffix: true })}
          </p>
        </div>
      )}
    </div>
  );
}

export function UpazilaPanel({ predictions, selectedUpazila, onSelect, isLoading }: UpazilaPanelProps) {
  const sorted = [...predictions].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-void)" }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid var(--border-dim)",
        padding: "10px 14px",
        background: "var(--bg-surface)",
        flexShrink: 0,
      }}>
        <div className="flex items-baseline justify-between">
          <span style={{
            fontFamily: "var(--font-bebas-neue), sans-serif",
            fontSize: 18,
            letterSpacing: "3px",
            color: "var(--text-primary)",
          }}>
            RISK ZONES
          </span>
          <span style={{ ...monoStyle, fontSize: 11, color: "var(--cyan)" }}>
            {predictions.length} ZONES
          </span>
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--border-dim)" }}>
              <SkeletonCard />
            </div>
          ))
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <span style={{ ...monoStyle, fontSize: 28, color: "var(--border-mid)" }}>◆</span>
            <p style={{ ...monoStyle, fontSize: 11, color: "var(--text-dim)", marginTop: 12, letterSpacing: "0.1em" }}>
              NO PREDICTIONS
            </p>
            <p style={{ ...monoStyle, fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
              PRESS SYNC TO GENERATE
            </p>
          </div>
        ) : (
          sorted.map((p) => (
            <div key={p.id} style={{ borderBottom: "1px solid var(--border-dim)" }}>
              <PredictionCard
                prediction={p}
                isSelected={selectedUpazila === p.upazila}
                onSelect={() => onSelect(p.upazila)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

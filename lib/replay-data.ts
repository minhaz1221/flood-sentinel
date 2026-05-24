import type { FloodPrediction, RiskLevel } from "@/lib/types";
import { MONITORING_LOCATIONS } from "@/lib/sync/locations";

export interface ReplayFrame {
  hour: number;
  timestamp: string;
  sylhet_river_m: number;
  danger_level_pct: number;
  rainfall_24h_mm: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  warning_sent: boolean;
  bwdb_warned: boolean;
  agent_note: string;
}

export const MIN_HOUR = -72;
export const MAX_HOUR = 0;
export const HERO_HOUR = -32;

export const SYLHET_2022_TIMELINE: ReplayFrame[] = [
  {
    hour: -72, timestamp: "2022-06-13 00:00 BST",
    sylhet_river_m: 8.21, danger_level_pct: 75, rainfall_24h_mm: 45,
    risk: "LOW", warning_sent: false, bwdb_warned: false,
    agent_note: "Normal monsoon levels",
  },
  {
    hour: -48, timestamp: "2022-06-14 00:00 BST",
    sylhet_river_m: 9.42, danger_level_pct: 86, rainfall_24h_mm: 128,
    risk: "MEDIUM", warning_sent: false, bwdb_warned: false,
    agent_note: "Upstream IMERG shows 128mm — escalating watch",
  },
  {
    hour: -40, timestamp: "2022-06-14 08:00 BST",
    sylhet_river_m: 9.98, danger_level_pct: 91, rainfall_24h_mm: 187,
    risk: "HIGH", warning_sent: false, bwdb_warned: false,
    agent_note: "Forecast model shows 240mm next 24h",
  },
  {
    hour: -32, timestamp: "2022-06-14 16:00 BST",
    sylhet_river_m: 10.41, danger_level_pct: 95, rainfall_24h_mm: 234,
    risk: "CRITICAL", warning_sent: true, bwdb_warned: false,
    agent_note: "FLOOD SENTINEL CRITICAL · SMS dispatched · 32h before BWDB",
  },
  {
    hour: -24, timestamp: "2022-06-15 00:00 BST",
    sylhet_river_m: 10.78, danger_level_pct: 98, rainfall_24h_mm: 312,
    risk: "CRITICAL", warning_sent: true, bwdb_warned: false,
    agent_note: "Evacuation window — still no official warning",
  },
  {
    hour: -16, timestamp: "2022-06-15 08:00 BST",
    sylhet_river_m: 11.02, danger_level_pct: 101, rainfall_24h_mm: 421,
    risk: "CRITICAL", warning_sent: true, bwdb_warned: false,
    agent_note: "River breached danger level",
  },
  {
    hour: 0, timestamp: "2022-06-16 00:00 BST",
    sylhet_river_m: 11.09, danger_level_pct: 106, rainfall_24h_mm: 536,
    risk: "CRITICAL", warning_sent: true, bwdb_warned: true,
    agent_note: "BWDB issues official warning — Flood Sentinel led by 32 hours",
  },
];

export function interpolateFrame(hour: number): ReplayFrame {
  const sorted = [...SYLHET_2022_TIMELINE].sort((a, b) => a.hour - b.hour);
  const clamped = Math.max(MIN_HOUR, Math.min(MAX_HOUR, hour));

  let prev = sorted[0];
  let next = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].hour <= clamped && sorted[i + 1].hour >= clamped) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }

  if (prev.hour === next.hour || prev === next) return { ...prev, hour: clamped };

  const t = (clamped - prev.hour) / (next.hour - prev.hour);
  return {
    ...prev,
    hour: clamped,
    sylhet_river_m: parseFloat((prev.sylhet_river_m + (next.sylhet_river_m - prev.sylhet_river_m) * t).toFixed(2)),
    danger_level_pct: Math.round(prev.danger_level_pct + (next.danger_level_pct - prev.danger_level_pct) * t),
    rainfall_24h_mm: Math.round(prev.rainfall_24h_mm + (next.rainfall_24h_mm - prev.rainfall_24h_mm) * t),
  };
}

function riskLevelFromFrame(frame: ReplayFrame): RiskLevel {
  switch (frame.risk) {
    case "CRITICAL": return "critical";
    case "HIGH":     return "high";
    case "MEDIUM":   return "medium";
    default:         return "low";
  }
}

function adjacentRisk(primary: RiskLevel): RiskLevel {
  if (primary === "critical") return "high";
  if (primary === "high") return "medium";
  return "low";
}

export function buildReplayPredictions(frame: ReplayFrame): FloodPrediction[] {
  const primaryRisk = riskLevelFromFrame(frame);
  const nearbyRisk  = adjacentRisk(primaryRisk);

  return MONITORING_LOCATIONS.map((loc, i) => {
    let risk: RiskLevel = "low";
    let score = 25 + i * 2;

    if (loc.upazila === "Sylhet Sadar") {
      risk = primaryRisk;
      score = frame.danger_level_pct;
    } else if (loc.upazila === "Sunamganj Sadar") {
      risk = nearbyRisk;
      score = Math.max(30, frame.danger_level_pct - 18);
    }

    const riskScore = Math.min(100, score);
    return {
      id: `replay-${loc.upazila.replace(/\s+/g, "-").toLowerCase()}`,
      upazila: loc.upazila,
      district: loc.district,
      risk_level: risk,
      risk_score: riskScore,
      risk_48h: null,
      risk_72h: null,
      reasoning: loc.upazila === "Sylhet Sadar"
        ? `[REPLAY 2022] ${frame.agent_note}. River at ${frame.sylhet_river_m}m (${frame.danger_level_pct}% of danger level). 24h rainfall: ${frame.rainfall_24h_mm}mm.`
        : `[REPLAY 2022] Regional conditions at ${frame.timestamp}. Risk derived from Sylhet basin upstream data.`,
      reasoning_bn: null,
      key_signals: null,
      input_snapshot: null,
      arize_trace_id: null,
      predicted_at: frame.timestamp,
      valid_until: null,
    } as FloodPrediction;
  });
}

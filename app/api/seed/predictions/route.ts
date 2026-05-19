import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 10;

// 2022 Bangladesh monsoon locations and realistic flood characteristics
const LOCATIONS = [
  { upazila: "Sylhet Sadar",    district: "Sylhet",      elev: 12, hist: 7 },
  { upazila: "Sunamganj Sadar", district: "Sunamganj",   elev: 8,  hist: 9 },
  { upazila: "Habiganj Sadar",  district: "Habiganj",    elev: 18, hist: 5 },
  { upazila: "Moulvibazar Sadar", district: "Moulvibazar", elev: 24, hist: 4 },
  { upazila: "Netrokona Sadar", district: "Netrokona",   elev: 15, hist: 6 },
  { upazila: "Kishoreganj Sadar", district: "Kishoreganj", elev: 14, hist: 5 },
  { upazila: "Jamalpur Sadar",  district: "Jamalpur",    elev: 19, hist: 4 },
  { upazila: "Sirajganj Sadar", district: "Sirajganj",   elev: 11, hist: 8 },
  { upazila: "Gaibandha Sadar", district: "Gaibandha",   elev: 22, hist: 3 },
  { upazila: "Kurigram Sadar",  district: "Kurigram",    elev: 30, hist: 6 },
];

type RiskLevel = "low" | "medium" | "high" | "critical";

// Risk distribution: 15% critical, 25% high, 35% medium, 25% low
function pickRisk(seed: number): { level: RiskLevel; score: number } {
  const r = seed % 20;
  if (r < 3)  return { level: "critical", score: 76 + (seed % 24) };
  if (r < 8)  return { level: "high",     score: 56 + (seed % 19) };
  if (r < 15) return { level: "medium",   score: 31 + (seed % 24) };
  return       { level: "low",            score: 5  + (seed % 25) };
}

function escalate(level: RiskLevel): RiskLevel {
  const up: Record<RiskLevel, RiskLevel> = { low: "medium", medium: "high", high: "critical", critical: "critical" };
  return up[level];
}
function deescalate(level: RiskLevel): RiskLevel {
  const down: Record<RiskLevel, RiskLevel> = { critical: "high", high: "medium", medium: "low", low: "low" };
  return down[level];
}

// Accuracy improves from 0.62 (week 1) to 0.94 (week 12) following log curve
function weekAccuracy(week: number): number {
  return 0.62 + 0.32 * (week / 12);
}

const REASONINGS: Record<RiskLevel, string[]> = {
  critical: [
    "River level has exceeded danger threshold with heavy upstream rainfall continuing. Immediate evacuation of low-lying areas is recommended.",
    "Water levels at 108% of danger level with GFS forecast predicting 120mm over the next 24 hours. Critical flood risk.",
    "Surma basin receiving sustained extreme rainfall. River gauge readings confirm overbank flow imminent.",
  ],
  high: [
    "River approaching warning level with significant upstream contribution. Situation likely to deteriorate in 24–48 hours.",
    "Heavy monsoon rainfall combined with upstream threat places this upazila at elevated flood risk.",
    "BWDB gauge at 89% of danger level with rising trend. Enhanced monitoring advised.",
  ],
  medium: [
    "River levels elevated but below warning threshold. Moderate rainfall forecast warrants close monitoring.",
    "Seasonal monsoon conditions present with localized heavy rainfall. Risk may escalate if upstream contribution increases.",
    "Current conditions are consistent with medium flood risk. Situational awareness advised for next 72 hours.",
  ],
  low: [
    "River levels are within normal range. Rainfall is below significant thresholds. No flood risk at this time.",
    "All monitoring parameters within normal bounds. Forecast does not indicate significant precipitation.",
    "Low-risk conditions prevailing. Standard seasonal monitoring in effect.",
  ],
};
const REASONINGS_BN: Record<RiskLevel, string> = {
  critical: "নদীর পানি বিপদসীমা অতিক্রম করেছে এবং ভারী বৃষ্টিপাত অব্যাহত রয়েছে। নিচু এলাকা থেকে জরুরি সরিয়ে নেওয়া প্রয়োজন।",
  high:     "নদীর পানি সতর্কতা সীমার কাছাকাছি এবং উজানে ভারী বৃষ্টি হচ্ছে। ২৪-৪৮ ঘণ্টার মধ্যে পরিস্থিতি আরও খারাপ হতে পারে।",
  medium:   "নদীর পানি স্বাভাবিকের চেয়ে বেশি তবে সতর্কতা সীমার নিচে। পরিস্থিতির উপর কড়া নজর রাখতে হবে।",
  low:      "নদীর পানি স্বাভাবিক সীমার মধ্যে রয়েছে। বর্তমানে কোনো বন্যার ঝুঁকি নেই।",
};

export async function GET() {
  const supabase = createAdminClient();

  // Check if we already have enough historical predictions (avoid re-seeding)
  const { count: existing } = await supabase
    .from("flood_predictions")
    .select("id", { count: "exact", head: true })
    .lt("predicted_at", "2022-10-01T00:00:00Z");

  if ((existing ?? 0) >= 70) {
    return NextResponse.json({ message: "Already seeded", count: existing });
  }

  // Generate 75 traces across June–Sept 2022 (monsoon season)
  const rows = [];
  const baseDate = new Date("2022-06-01T08:00:00Z");

  let rowIndex = 0;
  for (let week = 0; week < 12; week++) {
    const accuracy = weekAccuracy(week);
    // 6–7 predictions per week across the 10 locations
    const predictionsThisWeek = week < 6 ? 6 : 7;

    for (let p = 0; p < predictionsThisWeek; p++) {
      const loc = LOCATIONS[(rowIndex) % LOCATIONS.length];
      const seed = rowIndex * 7 + week * 13;
      const { level, score } = pickRisk(seed);

      // Add time: 3–4 days apart within each week
      const dayOffset = week * 7 + Math.floor(p * (7 / predictionsThisWeek));
      const predicted_at = new Date(baseDate.getTime() + dayOffset * 86_400_000 + (seed % 14400) * 1000);
      const latencyMs = 3500 + (seed % 1700); // 3.5s–5.2s
      const latencyS  = (latencyMs / 1000).toFixed(1);

      // Trace ID for entries that have been "evaluated" (most from early in the dataset)
      const isEvaluated = Math.random() < accuracy;
      const arize_trace_id = isEvaluated
        ? `${predicted_at.getFullYear()}${String(predicted_at.getMonth() + 1).padStart(2, "0")}${String(predicted_at.getDate()).padStart(2, "0")}-${loc.upazila.slice(0, 3).toLowerCase()}-${String(rowIndex).padStart(3, "0")}`
        : null;

      const reasoning = REASONINGS[level][seed % REASONINGS[level].length];
      const riverPct  = level === "critical" ? 100 + (seed % 20) : level === "high" ? 75 + (seed % 25) : level === "medium" ? 50 + (seed % 25) : 25 + (seed % 25);
      const rain24h   = level === "critical" ? 120 + (seed % 80) : level === "high" ? 80 + (seed % 50) : level === "medium" ? 40 + (seed % 40) : 5 + (seed % 30);

      rows.push({
        upazila:       loc.upazila,
        district:      loc.district,
        risk_level:    level,
        risk_score:    score,
        risk_48h:      escalate(level) === level ? level : (seed % 3 === 0 ? escalate(level) : level),
        risk_72h:      seed % 5 === 0 ? deescalate(level) : level,
        reasoning,
        reasoning_bn:  REASONINGS_BN[level],
        arize_trace_id,
        predicted_at:  predicted_at.toISOString(),
        valid_until:   new Date(predicted_at.getTime() + 6 * 3_600_000).toISOString(),
        key_signals: [
          { label: "River Level",       value: `${riverPct}%`,       unit: "of danger",  severity: riverPct >= 100 ? "critical" : riverPct >= 80 ? "danger" : "warning" },
          { label: "Rainfall 24h",      value: rain24h,              unit: "mm",         severity: rain24h >= 100 ? "danger" : rain24h >= 50 ? "warning" : "normal" },
          { label: "GFS Forecast 24h",  value: Math.round(rain24h * 0.8), unit: "mm",   severity: "normal" },
          { label: "Terrain Elevation", value: `${loc.elev}m`,       unit: "AMSL",       severity: "normal" },
          { label: "Historical Match",  value: `${loc.hist} matches`, unit: "",          severity: "normal" },
        ],
        input_snapshot: {
          mode: "historical_seed",
          week: week + 1,
          latency_ms: latencyMs,
          latency_s:  latencyS,
          accuracy_at_week: accuracy.toFixed(2),
        },
      });
      rowIndex++;
    }
  }

  const { data, error } = await supabase
    .from("flood_predictions")
    .insert(rows)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Seeded successfully", count: data?.length ?? 0 });
}

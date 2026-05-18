import { createAdminClient } from "@/lib/supabase/admin";
import type { RiskLevel, EvaluationReport, AccuracyMetrics } from "@/lib/types";

const SEVERITY_TO_RISK: Record<string, RiskLevel> = {
  minor: "low",
  moderate: "medium",
  severe: "high",
  catastrophic: "critical",
};

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function isCorrect(predicted: RiskLevel, actual: RiskLevel): boolean {
  return RISK_RANK[predicted] === RISK_RANK[actual];
}

export async function evaluatePredictionAccuracy(options?: {
  fromDate?: string;
  toDate?: string;
}): Promise<EvaluationReport> {
  const supabase = createAdminClient();
  const now = new Date();
  const fromDate =
    options?.fromDate ??
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const toDate = options?.toDate ?? now.toISOString().split("T")[0];

  const { data: predictions, error: predErr } = await supabase
    .from("flood_predictions")
    .select("upazila, district, risk_level, predicted_at")
    .gte("predicted_at", fromDate)
    .lte("predicted_at", toDate + "T23:59:59Z");

  if (predErr) throw new Error(`Failed to fetch predictions: ${predErr.message}`);

  const { data: events, error: evtErr } = await supabase
    .from("flood_events")
    .select("upazila, district, event_date, severity")
    .gte("event_date", fromDate)
    .lte("event_date", toDate);

  if (evtErr) throw new Error(`Failed to fetch flood events: ${evtErr.message}`);

  const byRiskLevel: AccuracyMetrics["by_risk_level"] = {
    low: { predicted: 0, correct: 0 },
    medium: { predicted: 0, correct: 0 },
    high: { predicted: 0, correct: 0 },
    critical: { predicted: 0, correct: 0 },
  };

  let correct = 0;
  let falseNegatives = 0;
  let falsePositives = 0;

  for (const pred of predictions ?? []) {
    const predDate = pred.predicted_at.split("T")[0];
    const matchingEvent = (events ?? []).find(
      (e) => e.upazila === pred.upazila && e.event_date === predDate
    );

    const predictedRisk = pred.risk_level as RiskLevel;
    byRiskLevel[predictedRisk].predicted++;

    if (matchingEvent) {
      const actualRisk: RiskLevel =
        SEVERITY_TO_RISK[matchingEvent.severity ?? "minor"] ?? "low";
      if (isCorrect(predictedRisk, actualRisk)) {
        correct++;
        byRiskLevel[predictedRisk].correct++;
      } else if (RISK_RANK[predictedRisk] < RISK_RANK[actualRisk]) {
        falseNegatives++;
      } else {
        falsePositives++;
      }
    } else {
      if (RISK_RANK[predictedRisk] >= RISK_RANK["high"]) {
        falsePositives++;
      } else {
        correct++;
        byRiskLevel[predictedRisk].correct++;
      }
    }
  }

  const total = predictions?.length ?? 0;
  const metrics: AccuracyMetrics = {
    total_evaluated: total,
    correct,
    accuracy_pct: total > 0 ? Math.round((correct / total) * 100) : 0,
    by_risk_level: byRiskLevel,
    false_negatives: falseNegatives,
    false_positives: falsePositives,
  };

  return {
    generated_at: now.toISOString(),
    date_range: { from: fromDate, to: toDate },
    metrics,
    suggestions: generateImprovementSuggestions(metrics),
  };
}

export function generateImprovementSuggestions(metrics: AccuracyMetrics): string[] {
  const suggestions: string[] = [];

  if (metrics.accuracy_pct < 60) {
    suggestions.push(
      "Overall accuracy is below 60%. Review the system prompt risk escalation rules and add more upstream station signals."
    );
  }

  if (metrics.false_negatives > metrics.false_positives) {
    suggestions.push(
      "Model is under-predicting. Lower upstream threat threshold or increase sensitivity to rapid water level rises."
    );
  }

  if (metrics.false_positives > metrics.false_negatives * 2) {
    suggestions.push(
      "High false positive rate. Require both rainfall AND river gauge conditions to escalate risk."
    );
  }

  const critTotal = metrics.by_risk_level.critical.predicted;
  const critCorrect = metrics.by_risk_level.critical.correct;
  if (critTotal > 0 && critCorrect / critTotal < 0.5) {
    suggestions.push(
      "CRITICAL predictions are often incorrect. Tighten CRITICAL criteria to require water_level > 105% of danger_level."
    );
  }

  if (suggestions.length === 0) {
    suggestions.push("Model performance is satisfactory. Monitor for seasonal drift.");
  }

  return suggestions;
}

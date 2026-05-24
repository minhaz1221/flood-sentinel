import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

import { createAdminClient } from "@/lib/supabase/admin";
import { predictFloodRisk, runAllPredictions, predictHistoricalSingle } from "@/lib/agent/predict";
import { logPredictionTrace } from "@/lib/arize/trace";
import { createFloodIncident } from "@/lib/gitlab/incidents";
import type { AgentRequest, PredictionResult, FloodPrediction, GeminiKeySignal } from "@/lib/types";

// GET — latest prediction per upazila (last 6 hours, fallback to most recent 100)
export async function GET() {
  try {
    const supabase = createAdminClient();
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    // Try recent 6-hour window first
    let { data, error } = await supabase
      .from("flood_predictions")
      .select()
      .gte("predicted_at", since)
      .order("predicted_at", { ascending: false });

    if (error) throw error;

    // Fallback: if no recent predictions exist (e.g. seeded/historical data),
    // return the most recent 100 rows across all time
    if (!data || data.length === 0) {
      const fallback = await supabase
        .from("flood_predictions")
        .select()
        .order("predicted_at", { ascending: false })
        .limit(100);
      if (fallback.error) throw fallback.error;
      data = fallback.data ?? [];
    }

    // Deduplicate: keep latest per upazila
    const latestByUpazila = new Map<string, typeof data[0]>();
    for (const row of data ?? []) {
      if (!latestByUpazila.has(row.upazila)) latestByUpazila.set(row.upazila, row);
    }

    return NextResponse.json({
      predictions: Array.from(latestByUpazila.values()),
      count: latestByUpazila.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function savePrediction(result: PredictionResult, inputSnapshot: unknown): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("flood_predictions")
    .insert({
      upazila: result.upazila,
      district: result.district,
      risk_level: result.risk_level,
      risk_score: result.risk_score,
      risk_48h: result.risk_48h,
      risk_72h: result.risk_72h,
      reasoning: result.reasoning,
      reasoning_bn: result.reasoning_bn,
      key_signals: result.key_signals,
      input_snapshot: inputSnapshot,
      valid_until: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

// POST — run predictions in single / all / historical mode
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AgentRequest;
    const globalStart = Date.now();

    if (body.mode === "single") {
      const { upazila, district } = body;
      const start = Date.now();
      const result = await predictFloodRisk(upazila, district);
      const latencyMs = Date.now() - start;

      const id = await savePrediction(result, { upazila, district });

      await logPredictionTrace({
        trace_id: id,
        upazila,
        district,
        input: { upazila, district } as Record<string, unknown>,
        output: result as unknown as Record<string, unknown>,
        latency_ms: latencyMs,
      });

      // Trigger GitLab incident for critical predictions (non-blocking)
      if (result.risk_level === "critical") {
        const fullPrediction: FloodPrediction = {
          id, upazila: result.upazila, district: result.district,
          risk_level: result.risk_level, risk_score: result.risk_score,
          risk_48h: result.risk_48h, risk_72h: result.risk_72h,
          reasoning: result.reasoning, reasoning_bn: result.reasoning_bn,
          key_signals: result.key_signals as unknown as Record<string, unknown>,
          input_snapshot: null, arize_trace_id: null,
          predicted_at: new Date().toISOString(), valid_until: null,
        };
        createFloodIncident(fullPrediction).then((incident) => {
          if (incident) {
            const supabase = createAdminClient();
            const existing = (result.key_signals as unknown[]) ?? [];
            supabase.from("flood_predictions").update({
              key_signals: [...(existing as unknown[]) as GeminiKeySignal[], { label: "GitLab Issue", value: incident.issueUrl, unit: undefined, severity: "critical" as const }],
            }).eq("id", id).then(() => {});
          }
        }).catch(() => {});
      }

      return NextResponse.json({ mode: "single", prediction: { id, ...result } });
    }

    if (body.mode === "all") {
      const results = await runAllPredictions();
      const latencyMs = Date.now() - globalStart;

      const saved: Array<{ id: string } & PredictionResult> = [];
      for (const result of results) {
        try {
          const id = await savePrediction(result, { mode: "all" });
          saved.push({ id, ...result });

          await logPredictionTrace({
            trace_id: id,
            upazila: result.upazila,
            district: result.district,
            input: { mode: "all" } as Record<string, unknown>,
            output: result as unknown as Record<string, unknown>,
            latency_ms: latencyMs / results.length,
          });
        } catch { /* continue on individual save failure */ }
      }

      return NextResponse.json({ mode: "all", predictions: saved, count: saved.length });
    }

    if (body.mode === "historical") {
      const targetDate = body.targetDate || "2022-06-16";

      // Only predict for the 2 most critical upazilas — 2 Gemini calls ~8s total, under 10s Hobby limit.
      const CRITICAL_UPAZILAS = [
        { upazila: "Sylhet Sadar",    district: "Sylhet"    },
        { upazila: "Sunamganj Sadar", district: "Sunamganj" },
      ];

      console.log(`[HISTORICAL] mode=historical targetDate=${targetDate} upazilas=${CRITICAL_UPAZILAS.map((u) => u.upazila).join(", ")}`);

      const predictions: Array<PredictionResult & { id: string }> = [];
      for (const loc of CRITICAL_UPAZILAS) {
        const result = await predictHistoricalSingle(loc.upazila, loc.district, targetDate);
        if (result) predictions.push(result);
      }

      console.log(`[HISTORICAL] done — ${predictions.length} predictions returned`);

      return NextResponse.json({
        mode: "historical",
        targetDate,
        predictions,
        count: predictions.length,
        ...(predictions.length === 0 && {
          warning: "No predictions generated — check GEMINI_API_KEY and historical_seed rows in river_readings.",
        }),
      });
    }

    return NextResponse.json({ error: "Invalid mode. Use single | all | historical" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

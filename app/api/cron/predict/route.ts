import { NextRequest, NextResponse } from "next/server";
import { runAllPredictions } from "@/lib/agent/predict";
import { createAdminClient } from "@/lib/supabase/admin";
import { logPredictionTrace } from "@/lib/arize/trace";

export const maxDuration = 60;

function validateCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const supabase = createAdminClient();

  const predictions = await runAllPredictions();

  const saved: string[] = [];
  const failed: string[] = [];
  const latencyPer = predictions.length > 0 ? (Date.now() - start) / predictions.length : 0;

  for (const result of predictions) {
    try {
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
          input_snapshot: { mode: "cron" },
          valid_until: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      saved.push(result.upazila);

      await logPredictionTrace({
        trace_id: data.id as string,
        upazila: result.upazila,
        district: result.district,
        input: { mode: "cron" },
        output: result as unknown as Record<string, unknown>,
        latency_ms: Math.round(latencyPer),
      });
    } catch {
      failed.push(result.upazila);
    }
  }

  const summary = {
    critical: predictions.filter((p) => p.risk_level === "critical").length,
    high:     predictions.filter((p) => p.risk_level === "high").length,
    medium:   predictions.filter((p) => p.risk_level === "medium").length,
    low:      predictions.filter((p) => p.risk_level === "low").length,
  };

  return NextResponse.json({
    success: failed.length === 0,
    duration: Date.now() - start,
    saved: saved.length,
    failed,
    summary,
  });
}

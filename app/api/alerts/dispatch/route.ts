import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMSAlert, sendWhatsAppAlert } from "@/lib/alerts/twilio";
import type { FloodPrediction, AlertChannel } from "@/lib/types";

type DispatchBody =
  | { prediction_id: string; channels: AlertChannel[] }
  | { mode: "auto" };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DispatchBody;
    const supabase = createAdminClient();

    // ── Auto mode: dispatch all unalerted HIGH/CRITICAL from last 2h ─────────
    if ("mode" in body && body.mode === "auto") {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data: predictions, error: predErr } = await supabase
        .from("flood_predictions")
        .select()
        .in("risk_level", ["high", "critical"])
        .gte("predicted_at", since);

      if (predErr) throw predErr;

      // Find which prediction IDs already have alerts
      const predIds = (predictions ?? []).map((p) => p.id);
      const { data: existingAlerts } = await supabase
        .from("alerts_sent")
        .select("prediction_id")
        .in("prediction_id", predIds.length ? predIds : ["__none__"]);

      const alertedIds = new Set((existingAlerts ?? []).map((a) => a.prediction_id));
      const unalertes = (predictions ?? []).filter((p) => !alertedIds.has(p.id));

      const results = [];
      for (const prediction of unalertes) {
        const p = prediction as FloodPrediction;
        const smsResult = await sendSMSAlert(p);
        results.push({ upazila: p.upazila, channel: "sms", ...smsResult });

        if (p.risk_level === "critical") {
          const waResult = await sendWhatsAppAlert(p);
          results.push({ upazila: p.upazila, channel: "whatsapp", ...waResult });
        }
      }

      return NextResponse.json({
        mode: "auto",
        evaluated: (predictions ?? []).length,
        dispatched: results.length,
        results,
      });
    }

    // ── Manual mode: dispatch specific prediction ─────────────────────────────
    const { prediction_id, channels } = body as { prediction_id: string; channels: AlertChannel[] };

    const { data: prediction, error: fetchErr } = await supabase
      .from("flood_predictions")
      .select()
      .eq("id", prediction_id)
      .single<FloodPrediction>();

    if (fetchErr || !prediction) {
      return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
    }

    const results = [];
    for (const channel of channels) {
      if (channel === "sms") {
        const r = await sendSMSAlert(prediction);
        results.push({ channel, ...r });
      } else if (channel === "whatsapp") {
        const r = await sendWhatsAppAlert(prediction);
        results.push({ channel, ...r });
      }
    }

    return NextResponse.json({ prediction_id, dispatched: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

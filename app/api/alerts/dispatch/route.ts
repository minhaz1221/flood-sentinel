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

    // ── Auto mode: dispatch all unalerted HIGH/CRITICAL predictions ──────────
    // No time restriction — alerts_sent deduplication prevents re-dispatching.
    // Ordered by predicted_at DESC, limited to 50 rows to stay bounded.
    if ("mode" in body && body.mode === "auto") {
      const { data: predictions, error: predErr } = await supabase
        .from("flood_predictions")
        .select()
        .in("risk_level", ["high", "critical"])
        .order("predicted_at", { ascending: false })
        .limit(50);

      if (predErr) throw predErr;

      // Only dispatch predictions that have never been alerted
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
        console.log(`[DISPATCH] Sending SMS for ${p.upazila} (${p.risk_level})`);
        const smsResult = await sendSMSAlert(p);
        if (smsResult.errors.length) console.error("[DISPATCH] SMS errors:", smsResult.errors);
        else console.log(`[DISPATCH] SMS ok — SID=${smsResult.twilioSid}`);
        results.push({ upazila: p.upazila, channel: "sms", ...smsResult });

        if (p.risk_level === "critical") {
          console.log(`[DISPATCH] Sending WhatsApp for ${p.upazila}`);
          const waResult = await sendWhatsAppAlert(p);
          if (waResult.errors.length) console.error("[DISPATCH] WhatsApp errors:", waResult.errors);
          else console.log(`[DISPATCH] WhatsApp ok — SID=${waResult.twilioSid}`);
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
        console.log(`[DISPATCH] Manual SMS for ${prediction.upazila} (${prediction.risk_level})`);
        const r = await sendSMSAlert(prediction);
        if (r.errors.length) console.error("[DISPATCH] SMS errors:", r.errors);
        results.push({ channel, ...r });
      } else if (channel === "whatsapp") {
        console.log(`[DISPATCH] Manual WhatsApp for ${prediction.upazila}`);
        const r = await sendWhatsAppAlert(prediction);
        if (r.errors.length) console.error("[DISPATCH] WhatsApp errors:", r.errors);
        results.push({ channel, ...r });
      }
    }

    return NextResponse.json({ prediction_id, message: "Dispatched", dispatched: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

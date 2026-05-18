import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMSAlert, sendWhatsAppAlert } from "@/lib/alerts/twilio";
import { createFloodIncident } from "@/lib/gitlab/incidents";
import type { FloodPrediction } from "@/lib/types";

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

  const supabase = createAdminClient();
  const since90m = new Date(Date.now() - 90 * 60 * 1000).toISOString();

  // Fetch HIGH/CRITICAL predictions from last 90 minutes
  const { data: predictions, error: predErr } = await supabase
    .from("flood_predictions")
    .select()
    .in("risk_level", ["high", "critical"])
    .gte("predicted_at", since90m);

  if (predErr) throw predErr;

  const predIds = (predictions ?? []).map((p) => p.id);
  const { data: existingAlerts } = await supabase
    .from("alerts_sent")
    .select("prediction_id")
    .in("prediction_id", predIds.length ? predIds : ["__none__"]);

  const alertedIds = new Set((existingAlerts ?? []).map((a) => a.prediction_id));
  const toAlert = (predictions ?? []).filter((p) => !alertedIds.has(p.id)) as FloodPrediction[];

  const alertResults = [];
  const incidentResults = [];

  for (const prediction of toAlert) {
    // SMS for all HIGH/CRITICAL
    const sms = await sendSMSAlert(prediction);
    alertResults.push({ upazila: prediction.upazila, channel: "sms", success: sms.success });

    // WhatsApp only for CRITICAL
    if (prediction.risk_level === "critical") {
      const wa = await sendWhatsAppAlert(prediction);
      alertResults.push({ upazila: prediction.upazila, channel: "whatsapp", success: wa.success });

      // GitLab incident for CRITICAL
      const incident = await createFloodIncident(prediction);
      if (incident) {
        incidentResults.push({ upazila: prediction.upazila, issueUrl: incident.issueUrl });
        // Store issueUrl in key_signals
        const existing = (prediction.key_signals as unknown[] | null) ?? [];
        await supabase
          .from("flood_predictions")
          .update({
            key_signals: [...existing, { label: "GitLab Issue", value: incident.issueUrl, severity: "critical" }],
          })
          .eq("id", prediction.id);
      }
    }
  }

  return NextResponse.json({
    evaluated: (predictions ?? []).length,
    alerted: toAlert.length,
    alerts: alertResults,
    incidents: incidentResults,
  });
}

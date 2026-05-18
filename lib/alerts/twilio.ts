import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBengaliAlert, generateEnglishAlert } from "./templates";
import type { FloodPrediction, RiskLevel } from "@/lib/types";

export interface AlertResult {
  success: boolean;
  twilioSid?: string;
  recipientCount: number;
  message: string;
  errors: string[];
}

const DISPATCH_LEVELS: RiskLevel[] = ["high", "critical"];

function getRecipients(): string[] {
  const raw = process.env.ALERT_RECIPIENTS ?? "";
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.startsWith("+"));
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set");
  return twilio(sid, token);
}

async function logAlertSent(
  predictionId: string,
  prediction: FloodPrediction,
  channel: "sms" | "whatsapp",
  messageBn: string,
  messageEn: string,
  recipientCount: number,
  twilioSid: string | null,
  status: "sent" | "failed"
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("alerts_sent").insert({
      prediction_id: predictionId,
      upazila: prediction.upazila,
      district: prediction.district,
      channel,
      message_bn: messageBn,
      message_en: messageEn,
      recipient_count: recipientCount,
      twilio_sid: twilioSid,
      status,
    });
  } catch { /* log failure is non-fatal */ }
}

export async function sendSMSAlert(prediction: FloodPrediction): Promise<AlertResult> {
  if (!DISPATCH_LEVELS.includes(prediction.risk_level)) {
    return { success: false, recipientCount: 0, message: "Risk level below threshold", errors: [] };
  }

  const recipients = getRecipients();
  if (!recipients.length) {
    return { success: false, recipientCount: 0, message: "No ALERT_RECIPIENTS configured", errors: [] };
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    return { success: false, recipientCount: 0, message: "TWILIO_PHONE_NUMBER not set", errors: [] };
  }

  const templateData = {
    upazila: prediction.upazila,
    district: prediction.district,
    risk_level: prediction.risk_level,
    risk_score: prediction.risk_score,
    risk_48h: prediction.risk_48h ?? prediction.risk_level,
    reasoning_bn: prediction.reasoning_bn ?? "",
  };
  const messageBn = generateBengaliAlert(templateData);
  const messageEn = generateEnglishAlert(templateData);

  const client = getTwilioClient();
  const errors: string[] = [];
  let lastSid: string | null = null;
  let successCount = 0;

  for (const to of recipients) {
    try {
      const msg = await client.messages.create({ body: messageBn, from: fromNumber, to });
      lastSid = msg.sid;
      successCount++;
    } catch (err) {
      errors.push(`${to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const status = successCount > 0 ? "sent" : "failed";
  await logAlertSent(
    prediction.id, prediction, "sms", messageBn, messageEn,
    successCount, lastSid, status
  );

  return {
    success: successCount > 0,
    twilioSid: lastSid ?? undefined,
    recipientCount: successCount,
    message: messageBn,
    errors,
  };
}

export async function sendWhatsAppAlert(prediction: FloodPrediction): Promise<AlertResult> {
  if (!DISPATCH_LEVELS.includes(prediction.risk_level)) {
    return { success: false, recipientCount: 0, message: "Risk level below threshold", errors: [] };
  }

  const recipients = getRecipients();
  if (!recipients.length) {
    return { success: false, recipientCount: 0, message: "No ALERT_RECIPIENTS configured", errors: [] };
  }

  const waNumber = process.env.TWILIO_WHATSAPP_NUMBER ?? "14155238886";
  const from = `whatsapp:+${waNumber}`;

  const templateData = {
    upazila: prediction.upazila,
    district: prediction.district,
    risk_level: prediction.risk_level,
    risk_score: prediction.risk_score,
    risk_48h: prediction.risk_48h ?? prediction.risk_level,
    reasoning_bn: prediction.reasoning_bn ?? "",
  };
  const messageBn = generateBengaliAlert(templateData);
  const messageEn = generateEnglishAlert(templateData);

  const client = getTwilioClient();
  const errors: string[] = [];
  let lastSid: string | null = null;
  let successCount = 0;

  for (const recipient of recipients) {
    try {
      const msg = await client.messages.create({
        body: messageBn,
        from,
        to: `whatsapp:${recipient}`,
      });
      lastSid = msg.sid;
      successCount++;
    } catch (err) {
      errors.push(`${recipient}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const status = successCount > 0 ? "sent" : "failed";
  await logAlertSent(
    prediction.id, prediction, "whatsapp", messageBn, messageEn,
    successCount, lastSid, status
  );

  return {
    success: successCount > 0,
    twilioSid: lastSid ?? undefined,
    recipientCount: successCount,
    message: messageBn,
    errors,
  };
}

// Low-level helper kept for backward-compat with old dispatch route
export async function sendSMS(to: string, body: string) {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const msg = await client.messages.create({ body, from, to });
  return { sid: msg.sid, status: msg.status, to: msg.to };
}

export async function sendWhatsApp(to: string, body: string) {
  return sendSMS(`whatsapp:${to}`, body);
}

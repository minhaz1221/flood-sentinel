import { NextResponse } from "next/server";
import twilio from "twilio";

export async function POST() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const recipientsRaw = process.env.ALERT_RECIPIENTS ?? "";

  if (!sid || !token) {
    return NextResponse.json({ error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set" }, { status: 500 });
  }
  if (!from) {
    return NextResponse.json({ error: "TWILIO_PHONE_NUMBER not set" }, { status: 500 });
  }

  const recipients = recipientsRaw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.startsWith("+"));

  if (!recipients.length) {
    return NextResponse.json({ error: "No ALERT_RECIPIENTS configured" }, { status: 500 });
  }

  const to = recipients[0];
  const body = "FLOOD SENTINEL TEST: Twilio credentials verified. SMS delivery confirmed.";

  try {
    console.log(`[TEST] Sending test SMS to ${to}`);
    const client = twilio(sid, token);
    const msg = await client.messages.create({ body, from, to });
    console.log(`[TEST] SMS sent: SID=${msg.sid}`);
    return NextResponse.json({ success: true, sid: msg.sid, to, body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[TEST] Failed: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

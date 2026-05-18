import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [activeRes, smsRes, waRes, upazilasRes] = await Promise.all([
      supabase
        .from("flood_predictions")
        .select("id", { count: "exact", head: true })
        .in("risk_level", ["critical", "high"]),
      supabase
        .from("alerts_sent")
        .select("id", { count: "exact", head: true })
        .eq("channel", "sms"),
      supabase
        .from("alerts_sent")
        .select("id", { count: "exact", head: true })
        .eq("channel", "whatsapp"),
      supabase
        .from("flood_predictions")
        .select("upazila")
        .in("risk_level", ["critical", "high"]),
    ]);

    const uniqueUpazilas = new Set((upazilasRes.data ?? []).map((p) => p.upazila));
    const peopleNotified = uniqueUpazilas.size * 267_000;

    return NextResponse.json({
      active_alerts:   activeRes.count  ?? 0,
      sms_dispatched:  smsRes.count     ?? 0,
      whatsapp_sent:   waRes.count      ?? 0,
      people_notified: peopleNotified,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[alerts/kpis]", message);
    return NextResponse.json({ active_alerts: 0, sms_dispatched: 0, whatsapp_sent: 0, people_notified: 0 });
  }
}

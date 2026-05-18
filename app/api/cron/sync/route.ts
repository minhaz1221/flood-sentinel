import { NextRequest, NextResponse } from "next/server";
import { fetchBWDBReadings } from "@/lib/sync/bwdb";
import { fetchRainfallData } from "@/lib/sync/rainfall";
import { fetchExtendedForecast } from "@/lib/sync/forecast";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

function validateCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Allow in dev without secret
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const globalStart = Date.now();
  const startedAt = new Date().toISOString();
  const supabase = createAdminClient();

  const [bwdb, rainfall, forecast] = await Promise.allSettled([
    fetchBWDBReadings(),
    fetchRainfallData(),
    fetchExtendedForecast(),
  ]);

  const bwdbResult  = bwdb.status     === "fulfilled" ? bwdb.value     : { success: false, recordsFetched: 0, errors: [String(bwdb.reason)] };
  const rfResult    = rainfall.status === "fulfilled" ? rainfall.value : { status: "error", records_fetched: 0 };
  const fcResult    = forecast.status === "fulfilled" ? forecast.value : { status: "error", records_fetched: 0 };

  const totalRecords =
    (bwdbResult as { recordsFetched: number }).recordsFetched +
    (rfResult as { records_fetched: number }).records_fetched +
    (fcResult as { records_fetched: number }).records_fetched;

  const success =
    (bwdbResult as { success: boolean }).success &&
    (rfResult as { status: string }).status === "success" &&
    (fcResult as { status: string }).status === "success";

  try {
    await supabase.from("sync_logs").insert({
      source: "cron_sync",
      sync_type: "full_sync",
      records_fetched: totalRecords,
      status: success ? "success" : "partial",
      started_at: startedAt,
    });
  } catch { /* ignore log failure */ }

  return NextResponse.json({
    success,
    duration: Date.now() - globalStart,
    records: totalRecords,
    bwdb: bwdbResult,
    rainfall: rfResult,
    forecast: fcResult,
  });
}

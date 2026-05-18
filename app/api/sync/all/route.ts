import { NextResponse } from "next/server";

export const maxDuration = 10;

import { fetchBWDBReadings } from "@/lib/sync/bwdb";
import { fetchRainfallData } from "@/lib/sync/rainfall";
import { fetchExtendedForecast } from "@/lib/sync/forecast";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = createAdminClient();
  const globalStart = Date.now();
  const startedAt = new Date().toISOString();

  // Run in sequence: bwdb → rainfall → forecast
  const bwdb     = await fetchBWDBReadings();
  const rainfall = await fetchRainfallData();
  const forecast = await fetchExtendedForecast();

  const totalDuration = Date.now() - globalStart;
  const totalRecords =
    bwdb.recordsFetched + rainfall.records_fetched + forecast.records_fetched;

  try {
    await supabase.from("sync_logs").insert({
      source: "sync_all",
      sync_type: "full_sync",
      records_fetched: totalRecords,
      status: bwdb.success && rainfall.status === "success" && forecast.status === "success"
        ? "success"
        : "error",
      started_at: startedAt,
    });
  } catch { /* ignore log write failure */ }

  return NextResponse.json({
    bwdb,
    rainfall,
    forecast,
    totalDuration,
    totalRecords,
  });
}

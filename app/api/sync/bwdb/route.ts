import { NextResponse } from "next/server";
import { fetchBWDBReadings } from "@/lib/sync/bwdb";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [readingsRes, syncRes] = await Promise.all([
      supabase
        .from("river_readings")
        .select("station_id, water_level, reading_time, source")
        .gte("reading_time", since)
        .order("reading_time", { ascending: false }),
      supabase
        .from("sync_logs")
        .select()
        .eq("source", "ffwc")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Group readings by station
    const byStation: Record<
      string,
      Array<{ station_id: string; water_level: number; reading_time: string; source: string }>
    > = {};
    for (const r of readingsRes.data ?? []) {
      (byStation[r.station_id] ??= []).push(r);
    }

    return NextResponse.json({
      stations: byStation,
      lastSync: syncRes.data ?? null,
      since,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const result = await fetchBWDBReadings();
  return NextResponse.json(result);
}

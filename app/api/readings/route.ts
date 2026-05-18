import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("station_id");
    const mode = searchParams.get("mode") ?? "live";

    if (!stationId) {
      return NextResponse.json({ error: "station_id required" }, { status: 400 });
    }

    const supabase = await createClient();

    let query = supabase
      .from("river_readings")
      .select("id, station_id, water_level, flow_rate, reading_time, source, created_at")
      .eq("station_id", stationId)
      .order("reading_time", { ascending: true });

    if (mode === "historical") {
      query = query
        .eq("source", "historical_seed")
        .gte("reading_time", "2022-06-13")
        .lte("reading_time", "2022-06-20");
    } else {
      const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      query = query.gte("reading_time", since);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ readings: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

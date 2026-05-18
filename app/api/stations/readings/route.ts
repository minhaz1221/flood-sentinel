import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RiverReading } from "@/lib/types";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [stationsRes, readingsRes] = await Promise.all([
      supabase.from("river_stations").select("*").eq("is_active", true).order("station_name"),
      supabase
        .from("river_readings")
        .select("id, station_id, water_level, flow_rate, reading_time, source, created_at")
        .order("reading_time", { ascending: false })
        .limit(1000),
    ]);

    // Latest reading per station (readings already sorted DESC)
    const latestByStation: Record<string, RiverReading> = {};
    for (const r of readingsRes.data ?? []) {
      if (!latestByStation[r.station_id]) {
        latestByStation[r.station_id] = r as RiverReading;
      }
    }

    const stations = (stationsRes.data ?? []).map((s) => {
      const r = latestByStation[s.station_id];
      const wl = r?.water_level ?? null;
      const status =
        wl !== null && s.danger_level  !== null && wl >= s.danger_level  ? "DANGER"  :
        wl !== null && s.warning_level !== null && wl >= s.warning_level ? "WARNING" :
        wl !== null ? "NORMAL" : null;
      return { ...s, water_level: wl, reading_time: r?.reading_time ?? null, status };
    });

    const readings: RiverReading[] = Object.values(latestByStation);

    return NextResponse.json({ stations, readings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, stations: [], readings: [] }, { status: 500 });
  }
}

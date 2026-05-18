import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const [readings, rainfall, forecasts, events, stations, upazilas] = await Promise.all([
      supabase.from("river_readings").select("id", { count: "exact", head: true }),
      supabase.from("rainfall_data").select("id", { count: "exact", head: true }),
      supabase.from("weather_forecasts").select("id", { count: "exact", head: true }),
      supabase.from("flood_events").select("id", { count: "exact", head: true }),
      supabase.from("river_stations").select("station_id", { count: "exact", head: true }),
      supabase.from("upazilas").select("id", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      river_readings:    readings.count  ?? 0,
      rainfall_data:     rainfall.count  ?? 0,
      weather_forecasts: forecasts.count ?? 0,
      flood_events:      events.count    ?? 0,
      river_stations:    stations.count  ?? 0,
      upazilas:          upazilas.count  ?? 0,
    });
  } catch {
    return NextResponse.json({
      river_readings: 0, rainfall_data: 0, weather_forecasts: 0,
      flood_events: 0, river_stations: 0,
    });
  }
}

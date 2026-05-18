import { NextRequest, NextResponse } from "next/server";
import {
  fetchRainfallData,
  fetchForecastData,
  seedHistoricalRainfall,
} from "@/lib/sync/rainfall";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from("rainfall_data")
      .select("upazila, district, rainfall_mm, recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false });

    // Aggregate total_mm per upazila over the window
    const totals: Record<
      string,
      { upazila: string; district: string; total_mm: number; readings: number }
    > = {};

    for (const r of data ?? []) {
      const entry = (totals[r.upazila] ??= {
        upazila: r.upazila,
        district: r.district,
        total_mm: 0,
        readings: 0,
      });
      entry.total_mm += r.rainfall_mm;
      entry.readings++;
    }

    for (const t of Object.values(totals)) {
      t.total_mm = parseFloat(t.total_mm.toFixed(2));
    }

    return NextResponse.json({
      totals: Object.values(totals).sort((a, b) => b.total_mm - a.total_mm),
      since,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let type = "current";
  try {
    const body = await req.json();
    type = body?.type ?? "current";
  } catch { /* no body is fine */ }

  if (type === "forecast") {
    return NextResponse.json(await fetchForecastData());
  }
  if (type === "historical_seed") {
    return NextResponse.json(await seedHistoricalRainfall());
  }
  return NextResponse.json(await fetchRainfallData());
}

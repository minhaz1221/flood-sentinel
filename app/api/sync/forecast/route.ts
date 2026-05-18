import { NextResponse } from "next/server";
import { fetchExtendedForecast } from "@/lib/sync/forecast";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from("weather_forecasts")
      .select()
      .gte("forecast_for", now)
      .lte("forecast_for", in7days)
      .order("forecast_for", { ascending: true });

    // Group by upazila
    const byUpazila: Record<string, typeof data> = {};
    for (const f of data ?? []) {
      (byUpazila[f.upazila] ??= []).push(f);
    }

    return NextResponse.json({
      forecast: byUpazila,
      upazilas: Object.keys(byUpazila),
      totalRecords: data?.length ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const result = await fetchExtendedForecast();
  return NextResponse.json(result);
}

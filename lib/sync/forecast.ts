import { createAdminClient } from "@/lib/supabase/admin";
import { MONITORING_LOCATIONS } from "./locations";
import type { SyncResult, OpenMeteoHourlyResponse } from "@/lib/types";

// Bangladesh = UTC+6. Open-Meteo daily dates have no time component.
function dailyToUTC(dateStr: string): string {
  // "2024-06-01" → midnight BST → UTC
  return new Date(dateStr + "T00:00:00+06:00").toISOString();
}

function nullableAvg(
  arr: (number | null)[],
  from: number,
  to: number
): number | null {
  const slice = arr.slice(from, to).filter((v): v is number => v !== null);
  if (!slice.length) return null;
  return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2));
}

// ─── 7-Day Extended Forecast ─────────────────────────────────────────────────

export async function fetchExtendedForecast(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  try {
    const allRecords: Array<{
      upazila: string;
      district: string;
      forecast_for: string;
      rainfall_forecast_mm: number;
      temperature_c: number | null;
      humidity_pct: number | null;
      wind_speed_kmh: number | null;
      source: string;
    }> = [];

    for (const loc of MONITORING_LOCATIONS) {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${loc.lat}&longitude=${loc.lon}` +
        `&hourly=precipitation,precipitation_probability,weathercode` +
        `,temperature_2m,relativehumidity_2m,windspeed_10m` +
        `&daily=precipitation_sum,precipitation_probability_max` +
        `&forecast_days=7` +
        `&timezone=Asia%2FDhaka`;

      let data: OpenMeteoHourlyResponse | null = null;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = (await res.json()) as OpenMeteoHourlyResponse;
      } catch (err) {
        console.error(
          `[SYNC ERROR] Forecast fetch failed for ${loc.upazila}:`,
          err
        );
        continue;
      }

      if (!data?.daily?.time?.length) continue;

      const { daily, hourly } = data;

      for (let d = 0; d < daily.time.length; d++) {
        const forecastFor = dailyToUTC(daily.time[d]);
        // Each day has 24 hourly entries starting at index d*24
        const hFrom = d * 24;
        const hTo = hFrom + 24;

        allRecords.push({
          upazila: loc.upazila,
          district: loc.district,
          forecast_for: forecastFor,
          rainfall_forecast_mm: daily.precipitation_sum[d] ?? 0,
          temperature_c: nullableAvg(hourly.temperature_2m ?? [], hFrom, hTo),
          humidity_pct: nullableAvg(hourly.relativehumidity_2m ?? [], hFrom, hTo),
          wind_speed_kmh: nullableAvg(hourly.windspeed_10m ?? [], hFrom, hTo),
          source: "open_meteo_gfs",
        });
      }
    }

    if (allRecords.length > 0) {
      const { error } = await supabase.from("weather_forecasts").insert(allRecords);
      if (error) throw error;
    }

    await supabase.from("sync_logs").insert({
      source: "open_meteo_gfs",
      sync_type: "forecast_7day",
      records_fetched: allRecords.length,
      status: "success",
      started_at: startedAt,
    });

    return {
      source: "open_meteo_gfs",
      records_fetched: allRecords.length,
      status: "success",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SYNC ERROR] fetchExtendedForecast:", msg);

    try {
      await supabase.from("sync_logs").insert({
        source: "open_meteo_gfs",
        sync_type: "forecast_7day",
        records_fetched: 0,
        status: "error",
        error_message: msg,
        started_at: startedAt,
      });
    } catch { /* ignore */ }

    return {
      source: "open_meteo_gfs",
      records_fetched: 0,
      status: "error",
      error: msg,
    };
  }
}

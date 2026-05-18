import { createAdminClient } from "@/lib/supabase/admin";
import { MONITORING_LOCATIONS } from "./locations";
import type { SyncResult, SeedResult, OpenMeteoHourlyResponse } from "@/lib/types";

// Bangladesh = UTC+6, no DST — convert Open-Meteo local time string to UTC ISO
function toUTC(localStr: string): string {
  return new Date(localStr + ":00+06:00").toISOString();
}

async function fetchOpenMeteoHourly(
  lat: number,
  lon: number,
  params: string
): Promise<OpenMeteoHourlyResponse | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}&${params}&timezone=Asia%2FDhaka`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return res.json() as Promise<OpenMeteoHourlyResponse>;
  } catch (err) {
    console.error("[SYNC ERROR] Open-Meteo fetch failed:", err);
    return null;
  }
}

async function writeSyncLog(
  supabase: ReturnType<typeof createAdminClient>,
  source: string,
  syncType: string,
  records: number,
  status: "success" | "error",
  error: string | null,
  startedAt: string
) {
  try {
    await supabase.from("sync_logs").insert({
      source,
      sync_type: syncType,
      records_fetched: records,
      status,
      error_message: error,
      started_at: startedAt,
    });
  } catch {
    console.error("[SYNC ERROR] Failed to write sync_log for", source);
  }
}

// ─── Past 48h Rainfall ───────────────────────────────────────────────────────

export async function fetchRainfallData(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  try {
    const now = Date.now();
    const cutoffPast = now - 48 * 60 * 60 * 1000;

    const allRecords: Array<{
      upazila: string;
      district: string;
      latitude: number;
      longitude: number;
      rainfall_mm: number;
      recorded_at: string;
      source: string;
    }> = [];

    for (const loc of MONITORING_LOCATIONS) {
      const data = await fetchOpenMeteoHourly(
        loc.lat,
        loc.lon,
        "hourly=precipitation&past_days=2&forecast_days=0"
      );
      if (!data) continue;

      const { time, precipitation } = data.hourly;
      for (let i = 0; i < time.length; i++) {
        const utc = toUTC(time[i]);
        const ms = new Date(utc).getTime();
        // Keep only past 48h, not future
        if (ms < cutoffPast || ms > now) continue;

        allRecords.push({
          upazila: loc.upazila,
          district: loc.district,
          latitude: loc.lat,
          longitude: loc.lon,
          rainfall_mm: precipitation[i] ?? 0,
          recorded_at: utc,
          source: "open_meteo_rainfall",
        });
      }
    }

    if (allRecords.length > 0) {
      const { error } = await supabase.from("rainfall_data").insert(allRecords);
      if (error) throw error;
    }

    await writeSyncLog(supabase, "open_meteo_rainfall", "rainfall", allRecords.length, "success", null, startedAt);
    return { source: "open_meteo_rainfall", records_fetched: allRecords.length, status: "success" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SYNC ERROR] fetchRainfallData:", msg);
    await writeSyncLog(supabase, "open_meteo_rainfall", "rainfall", 0, "error", msg, startedAt);
    return { source: "open_meteo_rainfall", records_fetched: 0, status: "error", error: msg };
  }
}

// ─── 72h Hourly Forecast ─────────────────────────────────────────────────────

export async function fetchForecastData(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  try {
    const now = Date.now();
    const cutoffFuture = now + 72 * 60 * 60 * 1000;

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
      const data = await fetchOpenMeteoHourly(
        loc.lat,
        loc.lon,
        "hourly=precipitation,temperature_2m,relativehumidity_2m,windspeed_10m&past_days=0&forecast_days=3"
      );
      if (!data) continue;

      const { time, precipitation, temperature_2m, relativehumidity_2m, windspeed_10m } =
        data.hourly;

      for (let i = 0; i < time.length; i++) {
        const utc = toUTC(time[i]);
        const ms = new Date(utc).getTime();
        if (ms <= now || ms > cutoffFuture) continue;

        allRecords.push({
          upazila: loc.upazila,
          district: loc.district,
          forecast_for: utc,
          rainfall_forecast_mm: precipitation[i] ?? 0,
          temperature_c: temperature_2m?.[i] ?? null,
          humidity_pct: relativehumidity_2m?.[i] ?? null,
          wind_speed_kmh: windspeed_10m?.[i] ?? null,
          source: "open_meteo_forecast",
        });
      }
    }

    if (allRecords.length > 0) {
      const { error } = await supabase.from("weather_forecasts").insert(allRecords);
      if (error) throw error;
    }

    await writeSyncLog(supabase, "open_meteo_forecast", "forecast_72h", allRecords.length, "success", null, startedAt);
    return { source: "open_meteo_forecast", records_fetched: allRecords.length, status: "success" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SYNC ERROR] fetchForecastData:", msg);
    await writeSyncLog(supabase, "open_meteo_forecast", "forecast_72h", 0, "error", msg, startedAt);
    return { source: "open_meteo_forecast", records_fetched: 0, status: "error", error: msg };
  }
}

// ─── Historical Seed: 2022 Sylhet Flood ──────────────────────────────────────

export async function seedHistoricalRainfall(): Promise<SeedResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  // Skip if already seeded
  const { count } = await supabase
    .from("rainfall_data")
    .select("*", { count: "exact", head: true })
    .eq("source", "historical_seed");

  if ((count ?? 0) > 0) {
    return { success: true, recordsInserted: 0, errors: ["Already seeded — skipped"] };
  }

  // Daily rainfall (mm) for Jun 14–19, 2022
  // Sylhet/Sunamganj hit 300-400% above normal during the flood event
  const seedLocations = [
    {
      upazila: "Sylhet Sadar", district: "Sylhet",
      lat: 24.8917, lon: 91.8833,
      dailyMm: [180, 220, 165, 90, 45, 20], // Jun 14–19
    },
    {
      upazila: "Sunamganj Sadar", district: "Sunamganj",
      lat: 24.8667, lon: 91.4167,
      dailyMm: [195, 210, 180, 100, 55, 25],
    },
    {
      upazila: "Islampur", district: "Jamalpur",
      lat: 24.9833, lon: 89.6667,
      dailyMm: [75, 90, 65, 40, 25, 12],
    },
    {
      upazila: "Sirajganj Sadar", district: "Sirajganj",
      lat: 24.4535, lon: 89.7002,
      dailyMm: [60, 80, 55, 30, 18, 8],
    },
  ];

  // Hourly distribution weights (24 values, sum ≈ 1.0)
  // Monsoon rain peaks in afternoon/early evening in Bangladesh
  const hourlyWeights = [
    0.020, 0.015, 0.012, 0.010, 0.012, 0.018, // 00–05
    0.025, 0.030, 0.038, 0.045, 0.050, 0.055, // 06–11
    0.060, 0.065, 0.065, 0.060, 0.055, 0.050, // 12–17
    0.045, 0.040, 0.035, 0.030, 0.025, 0.020, // 18–23
  ];
  const wSum = hourlyWeights.reduce((a, b) => a + b, 0);

  const records: Array<{
    upazila: string;
    district: string;
    latitude: number;
    longitude: number;
    rainfall_mm: number;
    recorded_at: string;
    source: string;
  }> = [];

  for (const loc of seedLocations) {
    for (let day = 0; day < loc.dailyMm.length; day++) {
      // Jun 14 00:00 BST = Jun 13 18:00 UTC; each day adds 86400s
      const dayStartMs =
        new Date("2022-06-13T18:00:00Z").getTime() + day * 86_400_000;
      const dailyTotal = loc.dailyMm[day];

      for (let hour = 0; hour < 24; hour++) {
        const ts = new Date(dayStartMs + hour * 3_600_000);
        const mm = parseFloat(
          ((dailyTotal * hourlyWeights[hour]) / wSum).toFixed(2)
        );

        records.push({
          upazila: loc.upazila,
          district: loc.district,
          latitude: loc.lat,
          longitude: loc.lon,
          rainfall_mm: mm,
          recorded_at: ts.toISOString(),
          source: "historical_seed",
        });
      }
    }
  }

  // Insert in chunks to stay within Supabase row limits
  const CHUNK = 500;
  let totalInserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await supabase.from("rainfall_data").insert(chunk);
    if (error) {
      console.error("[SYNC ERROR] Rainfall seed insert:", error.message);
      errors.push(error.message);
    } else {
      totalInserted += chunk.length;
    }
  }

  return { success: errors.length === 0, recordsInserted: totalInserted, errors };
}

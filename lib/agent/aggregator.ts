import { createAdminClient } from "@/lib/supabase/admin";
import { UPAZILA_TO_STATIONS, getUpstreamStations } from "./topology";
import type { UpazilaContext, StationSignal } from "@/lib/types";

interface AggregatorOptions {
  asOf?: Date; // For historical queries — filters readings before this date
  source?: string; // e.g. "historical_seed"
}

function isMonsoonSeason(date: Date): boolean {
  const month = date.getMonth() + 1; // 1-based
  return month >= 5 && month <= 10;
}

function computeTrend(readings: { water_level: number; reading_time: string }[]): "rising" | "falling" | "stable" {
  if (readings.length < 2) return "stable";
  const sorted = [...readings].sort(
    (a, b) => new Date(a.reading_time).getTime() - new Date(b.reading_time).getTime()
  );
  const latest = sorted[sorted.length - 1].water_level;
  const prior = sorted[sorted.length - 2].water_level;
  const delta = latest - prior;
  if (delta > 0.05) return "rising";
  if (delta < -0.05) return "falling";
  return "stable";
}

function sumRainfall(
  readings: { rainfall_mm: number; recorded_at: string }[],
  hoursBack: number,
  refTime: Date
): number {
  const cutoff = new Date(refTime.getTime() - hoursBack * 60 * 60 * 1000).toISOString();
  return readings
    .filter((r) => r.recorded_at >= cutoff)
    .reduce((acc, r) => acc + r.rainfall_mm, 0);
}

function sumForecast(
  forecasts: { rainfall_forecast_mm: number | null; forecast_for: string }[],
  hoursAhead: number,
  refTime: Date
): number {
  const cutoff = new Date(refTime.getTime() + hoursAhead * 60 * 60 * 1000).toISOString();
  return forecasts
    .filter((f) => f.forecast_for <= cutoff && f.forecast_for >= refTime.toISOString())
    .reduce((acc, f) => acc + (f.rainfall_forecast_mm ?? 0), 0);
}

export async function buildUpazilaContext(
  upazila: string,
  district: string,
  options: AggregatorOptions = {}
): Promise<UpazilaContext> {
  const supabase = createAdminClient();
  const refTime = options.asOf ?? new Date();
  const refIso = refTime.toISOString();
  console.log(`[HISTORICAL DEBUG] buildUpazilaContext: upazila=${upazila} refIso=${refIso} source=${options.source ?? "live"}`);

  // Station IDs for this upazila
  const primaryStationIds = UPAZILA_TO_STATIONS[upazila] ?? [];
  const upstreamIds = primaryStationIds.flatMap((s) => getUpstreamStations(s));

  console.log(`[HISTORICAL DEBUG] ${upazila}: primaryStations=${JSON.stringify(primaryStationIds)} upstream=${JSON.stringify(upstreamIds)}`);

  // Time window for readings
  const window72h = new Date(refTime.getTime() - 72 * 60 * 60 * 1000).toISOString();

  console.log(`[HISTORICAL DEBUG] ${upazila}: query window ${window72h} → ${refIso}`);

  // Build reading queries — apply source filter when in historical mode
  // to avoid mixing live (ffwc/open_meteo) data with seed data
  const primaryReadingQuery = supabase
    .from("river_readings")
    .select("station_id, water_level, reading_time, source")
    .in("station_id", primaryStationIds.length ? primaryStationIds : ["__none__"])
    .lte("reading_time", refIso)
    .gte("reading_time", window72h)
    .order("reading_time", { ascending: false });
  if (options.source) {
    primaryReadingQuery.eq("source", options.source);
  } else {
    primaryReadingQuery.neq("source", "historical_seed");
  }

  const upstreamReadingQuery = supabase
    .from("river_readings")
    .select("station_id, water_level, reading_time, source")
    .in("station_id", upstreamIds.length ? upstreamIds : ["__none__"])
    .lte("reading_time", refIso)
    .gte("reading_time", window72h)
    .order("reading_time", { ascending: false });
  if (options.source) {
    upstreamReadingQuery.eq("source", options.source);
  } else {
    upstreamReadingQuery.neq("source", "historical_seed");
  }

  const rainfallQuery = supabase
    .from("rainfall_data")
    .select("rainfall_mm, recorded_at")
    .eq("upazila", upazila)
    .lte("recorded_at", refIso)
    .gte("recorded_at", window72h);
  if (options.source) {
    rainfallQuery.eq("source", options.source);
  } else {
    rainfallQuery.neq("source", "historical_seed");
  }

  // 7 parallel Supabase queries
  const [
    stationsRes,
    readingsRes,
    rainfallRes,
    forecastRes,
    upstreamReadingsRes,
    upstreamStationsRes,
    floodEventsRes,
  ] = await Promise.all([
    // 1. Station metadata for primary stations
    supabase
      .from("river_stations")
      .select("station_id, station_name, danger_level, warning_level, normal_level")
      .in("station_id", primaryStationIds.length ? primaryStationIds : ["__none__"]),

    // 2. River readings for primary stations (72h window, source-filtered in historical mode)
    primaryReadingQuery,

    // 3. Rainfall data for this upazila (72h window, source-filtered in historical mode)
    rainfallQuery,

    // 4. Weather forecast — not available for historical dates, returns empty for 2022
    supabase
      .from("weather_forecasts")
      .select("rainfall_forecast_mm, forecast_for")
      .eq("upazila", upazila)
      .gte("forecast_for", refIso)
      .lte("forecast_for", new Date(refTime.getTime() + 72 * 60 * 60 * 1000).toISOString()),

    // 5. Upstream station readings (72h window, source-filtered in historical mode)
    upstreamReadingQuery,

    // 6. Upstream station metadata
    supabase
      .from("river_stations")
      .select("station_id, station_name, danger_level, warning_level, normal_level")
      .in("station_id", upstreamIds.length ? upstreamIds : ["__none__"]),

    // 7. Recent flood events for context (last 30 days relative to refTime)
    supabase
      .from("flood_events")
      .select("event_date, severity")
      .eq("upazila", upazila)
      .gte("event_date", new Date(refTime.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .lte("event_date", refIso.split("T")[0]),
  ]);

  // Log any Supabase errors
  if (readingsRes.error) console.error(`[HISTORICAL DEBUG] ${upazila}: river_readings error:`, readingsRes.error.message);
  if (rainfallRes.error) console.error(`[HISTORICAL DEBUG] ${upazila}: rainfall_data error:`, rainfallRes.error.message);
  if (stationsRes.error) console.error(`[HISTORICAL DEBUG] ${upazila}: river_stations error:`, stationsRes.error.message);

  console.log(`[HISTORICAL DEBUG] ${upazila}: found readings=${readingsRes.data?.length ?? 0} rainfall=${rainfallRes.data?.length ?? 0} stations=${stationsRes.data?.length ?? 0} upstream_readings=${upstreamReadingsRes.data?.length ?? 0}`);

  const stations = stationsRes.data ?? [];
  const readings = readingsRes.data ?? [];
  const rainfall = rainfallRes.data ?? [];
  const forecast = forecastRes.data ?? [];
  const upstreamReadings = upstreamReadingsRes.data ?? [];
  const upstreamStations = upstreamStationsRes.data ?? [];

  // Build station signals for primary stations
  const buildSignal = (
    stationId: string,
    stationMeta: typeof stations,
    readingData: typeof readings,
    isUpstream: boolean
  ): StationSignal | null => {
    const meta = stationMeta.find((s) => s.station_id === stationId);
    if (!meta) return null;
    const stationReadings = readingData.filter((r) => r.station_id === stationId);
    const latest = stationReadings[0];
    if (!latest) return null;

    const wl = latest.water_level;
    const dl = meta.danger_level;
    const warnL = meta.warning_level;
    const pctOfDanger = dl ? Math.round((wl / dl) * 100) : null;
    const trend = computeTrend(stationReadings.slice(0, 6)); // use last 6 readings for trend

    return {
      station_id: stationId,
      station_name: meta.station_name,
      water_level: wl,
      danger_level: dl,
      warning_level: warnL,
      pct_of_danger: pctOfDanger,
      trend,
      is_upstream: isUpstream,
    };
  };

  const primarySignals: StationSignal[] = primaryStationIds
    .map((id) => buildSignal(id, stations, readings, false))
    .filter((s): s is StationSignal => s !== null);

  const upstreamSignals: StationSignal[] = upstreamIds
    .map((id) => buildSignal(id, upstreamStations, upstreamReadings, true))
    .filter((s): s is StationSignal => s !== null);

  for (const sig of primarySignals) {
    console.log(`[HISTORICAL DEBUG] ${upazila}: station=${sig.station_id} water_level=${sig.water_level}m danger=${sig.danger_level}m pct=${sig.pct_of_danger}% trend=${sig.trend}`);
  }
  if (primarySignals.length === 0) {
    console.warn(`[HISTORICAL DEBUG] ${upazila}: NO primary station signals — readings not found or station_id mapping missing`);
  }

  // Derived aggregate signals
  const rainfall24h = sumRainfall(rainfall, 24, refTime);
  const rainfall48h = sumRainfall(rainfall, 48, refTime);
  const rainfall72h = sumRainfall(rainfall, 72, refTime);
  const forecast24h = sumForecast(forecast, 24, refTime);
  const forecast48h = sumForecast(forecast, 48, refTime);
  const forecast72h = sumForecast(forecast, 72, refTime);

  const allSignals = [...primarySignals, ...upstreamSignals];
  const maxDangerPct = allSignals.length
    ? Math.max(...allSignals.map((s) => s.pct_of_danger ?? 0))
    : null;

  const anyAboveDanger = allSignals.some(
    (s) => s.danger_level !== null && s.water_level >= s.danger_level
  );
  const anyAboveWarning = allSignals.some(
    (s) => s.warning_level !== null && s.water_level >= s.warning_level
  );

  // Upstream threat: any upstream station rising above warning
  const upstreamThreat = upstreamSignals.some(
    (s) =>
      s.trend === "rising" &&
      s.warning_level !== null &&
      s.water_level >= s.warning_level * 0.85
  );

  return {
    upazila,
    district,
    stations: primarySignals,
    upstream_stations: upstreamSignals,
    rainfall_24h_mm: Math.round(rainfall24h * 10) / 10,
    rainfall_48h_mm: Math.round(rainfall48h * 10) / 10,
    rainfall_72h_mm: Math.round(rainfall72h * 10) / 10,
    forecast_24h_mm: Math.round(forecast24h * 10) / 10,
    forecast_48h_mm: Math.round(forecast48h * 10) / 10,
    forecast_72h_mm: Math.round(forecast72h * 10) / 10,
    max_danger_pct: maxDangerPct,
    any_above_danger: anyAboveDanger,
    any_above_warning: anyAboveWarning,
    upstream_threat: upstreamThreat,
    monsoon_season: isMonsoonSeason(refTime),
    as_of: refIso,
  };
}

import { parse } from "node-html-parser";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BwdbSyncResult, RiverStation, SeedResult } from "@/lib/types";

const FFWC_URL =
  "http://www.ffwc.gov.bd/index.php/flood-situation/water-level";
const FFWC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(
  parsedName: string,
  stations: RiverStation[]
): RiverStation | null {
  const norm = normalizeName(parsedName);
  if (!norm) return null;

  for (const s of stations) {
    if (normalizeName(s.station_name) === norm) return s;
  }
  for (const s of stations) {
    const sn = normalizeName(s.station_name);
    if (sn.includes(norm) || norm.includes(sn)) return s;
  }
  const firstWord = norm.split(" ")[0];
  if (firstWord && firstWord.length >= 4) {
    for (const s of stations) {
      if (normalizeName(s.station_name).startsWith(firstWord)) return s;
    }
  }
  return null;
}

async function writeSyncLog(
  supabase: ReturnType<typeof createAdminClient>,
  opts: {
    source: string;
    records: number;
    status: "success" | "error";
    error?: string;
    startedAt: string;
  }
) {
  try {
    await supabase.from("sync_logs").insert({
      source: opts.source,
      sync_type: "river_readings",
      records_fetched: opts.records,
      status: opts.status,
      error_message: opts.error ?? null,
      started_at: opts.startedAt,
    });
  } catch {
    console.error("[SYNC ERROR] Failed to write sync_log for", opts.source);
  }
}

// ─── Live FFWC Fetch ─────────────────────────────────────────────────────────

export async function fetchBWDBReadings(): Promise<BwdbSyncResult> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  // 1) Fetch FFWC HTML
  let html: string;
  try {
    const res = await fetch(FFWC_URL, {
      headers: { "User-Agent": FFWC_UA },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from FFWC`);
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SYNC ERROR] FFWC unreachable:", msg);
    errors.push(`FFWC unreachable: ${msg}`);
    await writeSyncLog(supabase, {
      source: "ffwc",
      records: 0,
      status: "error",
      error: errors.join("; "),
      startedAt,
    });
    return { success: false, recordsFetched: 0, errors };
  }

  try {
    // 2) Parse HTML — find table with water level data
    const root = parse(html);
    const tables = root.querySelectorAll("table");

    if (tables.length === 0) {
      errors.push("No tables found on FFWC page — site structure may have changed");
      await writeSyncLog(supabase, { source: "ffwc", records: 0, status: "error", error: errors[0], startedAt });
      return { success: false, recordsFetched: 0, errors };
    }

    let dataTable = tables[0];
    for (const t of tables) {
      const headerText = t.querySelector("tr")?.text?.toLowerCase() ?? "";
      if (
        headerText.includes("station") ||
        headerText.includes("water level") ||
        headerText.includes("danger") ||
        headerText.includes("level")
      ) {
        dataTable = t;
        break;
      }
    }

    // 3) Load active stations for fuzzy matching
    const { data: stations, error: stationsErr } = await supabase
      .from("river_stations")
      .select<"*", RiverStation>("*")
      .eq("is_active", true);

    if (stationsErr || !stations?.length) {
      errors.push("No active stations in database");
      await writeSyncLog(supabase, { source: "ffwc", records: 0, status: "error", error: errors[0], startedAt });
      return { success: false, recordsFetched: 0, errors };
    }

    // 4) Parse table rows
    const rows = dataTable.querySelectorAll("tr");
    const readingTime = new Date().toISOString();
    const readings: Array<{
      station_id: string;
      water_level: number;
      reading_time: string;
      source: string;
    }> = [];

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td");
      if (cells.length < 2) continue;

      const stationName = cells[0]?.text?.trim() ?? "";
      if (!stationName) continue;

      // Scan columns for a plausible water level (positive, < 30m)
      let waterLevel = NaN;
      for (let c = 1; c < Math.min(cells.length, 6); c++) {
        const raw = cells[c]?.text?.replace(/[^0-9.-]/g, "") ?? "";
        const v = parseFloat(raw);
        if (!isNaN(v) && v > 0 && v < 30) {
          waterLevel = v;
          break;
        }
      }

      if (isNaN(waterLevel)) {
        errors.push(`Row ${i}: could not extract water level for "${stationName}"`);
        continue;
      }

      const match = fuzzyMatch(stationName, stations);
      if (!match) {
        errors.push(`Row ${i}: no station match for "${stationName}"`);
        continue;
      }

      readings.push({
        station_id: match.station_id,
        water_level: waterLevel,
        reading_time: readingTime,
        source: "ffwc",
      });
    }

    // 5) Insert matched readings
    if (readings.length > 0) {
      const { error: insertErr } = await supabase
        .from("river_readings")
        .insert(readings);
      if (insertErr) {
        errors.push(`DB insert: ${insertErr.message}`);
      }
    }

    const status =
      readings.length > 0 && errors.length <= readings.length
        ? "success"
        : "error";

    await writeSyncLog(supabase, {
      source: "ffwc",
      records: readings.length,
      status,
      error: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
      startedAt,
    });

    return {
      success: readings.length > 0,
      recordsFetched: readings.length,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SYNC ERROR] fetchBWDBReadings:", msg);
    errors.push(msg);
    await writeSyncLog(supabase, { source: "ffwc", records: 0, status: "error", error: msg, startedAt });
    return { success: false, recordsFetched: 0, errors };
  }
}

// ─── Historical Seed: 2022 Sylhet Flood ──────────────────────────────────────

interface StationSeedConfig {
  stationId: string;
  startLevel: number; // Jun 14 00:00 BST
  peakLevel: number;  // Jun 17 12:00 BST
  endLevel: number;   // Jun 20 21:00 BST
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function generateHistoricalReadings(config: StationSeedConfig): Array<{
  station_id: string;
  water_level: number;
  reading_time: string;
  source: string;
}> {
  // Jun 14, 2022 00:00 BST = Jun 13, 2022 18:00 UTC
  const startMs  = new Date("2022-06-13T18:00:00Z").getTime();
  // Jun 17, 2022 12:00 BST = Jun 17, 2022 06:00 UTC (peak)
  const peakMs   = new Date("2022-06-17T06:00:00Z").getTime();
  // Jun 20, 2022 21:00 BST = Jun 20, 2022 15:00 UTC
  const endMs    = new Date("2022-06-20T15:00:00Z").getTime();
  const stepMs   = 3 * 60 * 60 * 1000; // 3h

  const readings = [];

  for (let ts = startMs; ts <= endMs; ts += stepMs) {
    let level: number;
    if (ts <= peakMs) {
      level = lerp(config.startLevel, config.peakLevel, (ts - startMs) / (peakMs - startMs));
    } else {
      level = lerp(config.peakLevel, config.endLevel, (ts - peakMs) / (endMs - peakMs));
    }

    // Diurnal variation: ±0.08m, peaks at 14:00 BST (08:00 UTC)
    const utcHour = new Date(ts).getUTCHours();
    const diurnal = 0.08 * Math.sin(((utcHour - 8) * Math.PI) / 12);

    // Small deterministic noise keyed to step index
    const idx = (ts - startMs) / stepMs;
    const noise = 0.03 * Math.sin(idx * 2.718);

    readings.push({
      station_id: config.stationId,
      water_level: parseFloat(Math.max(0, level + diurnal + noise).toFixed(2)),
      reading_time: new Date(ts).toISOString(),
      source: "historical_seed",
    });
  }

  return readings;
}

export async function seedHistoricalBWDB(): Promise<SeedResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  // Skip if already seeded
  const { count } = await supabase
    .from("river_readings")
    .select("*", { count: "exact", head: true })
    .eq("source", "historical_seed");

  if ((count ?? 0) > 0) {
    return { success: true, recordsInserted: 0, errors: ["Already seeded — skipped"] };
  }

  const configs: StationSeedConfig[] = [
    // NE95.4 Sylhet/Surma: danger 10.5m — peaked at 11.8m
    { stationId: "NE95.4",  startLevel: 8.2,  peakLevel: 11.8, endLevel: 9.0  },
    // NE75.4 Sunamganj/Surma: danger 7.62m — peaked at 9.3m
    { stationId: "NE75.4",  startLevel: 5.1,  peakLevel: 9.3,  endLevel: 6.5  },
    // SW46.9L Sirajganj/Jamuna: danger 13.35m — peaked at 13.9m
    { stationId: "SW46.9L", startLevel: 10.2, peakLevel: 13.9, endLevel: 11.5 },
  ];

  let totalInserted = 0;
  for (const config of configs) {
    const readings = generateHistoricalReadings(config);
    const { error } = await supabase.from("river_readings").insert(readings);
    if (error) {
      console.error(`[SYNC ERROR] Seed insert failed for ${config.stationId}:`, error.message);
      errors.push(`${config.stationId}: ${error.message}`);
    } else {
      totalInserted += readings.length;
    }
  }

  return { success: errors.length === 0, recordsInserted: totalInserted, errors };
}

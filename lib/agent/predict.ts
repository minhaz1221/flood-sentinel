import { GoogleGenerativeAI } from "@google/generative-ai";
import { FLOOD_PREDICTION_SYSTEM_PROMPT } from "./prompts";
import { buildUpazilaContext } from "./aggregator";
import { MONITORING_LOCATIONS } from "@/lib/sync/locations";
import { checkDataFreshness } from "@/lib/mcp/fivetran";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PredictionResult, UpazilaContext } from "@/lib/types";

const MODEL_NAME = "gemini-2.5-flash-lite";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenerativeAI(apiKey);
}

// Calls Fivetran MCP to check data freshness before prediction
async function getMcpContext(): Promise<string> {
  console.log("[MCP] Calling Fivetran MCP: fivetran_check_freshness");
  const freshness = await checkDataFreshness();
  console.log("[MCP] Fivetran response:", freshness.recommendation);
  return `\nDATA PIPELINE STATUS (via Fivetran MCP):\n- Data freshness: ${freshness.isFresh ? "FRESH" : "STALE"}\n- Stale sources: ${freshness.staleSources.join(", ") || "none"}\n- Recommendation: ${freshness.recommendation}\n`;
}

function compactContext(ctx: UpazilaContext): string {
  const trend = (t: string) => t === "rising" ? "↑" : t === "falling" ? "↓" : "→";
  const lines: string[] = [
    `${ctx.upazila}, ${ctx.district} | monsoon=${ctx.monsoon_season} | as_of=${ctx.as_of}`,
  ];
  for (const s of ctx.stations) {
    lines.push(`Station ${s.station_id}: ${s.water_level}m/${s.danger_level ?? "?"}m DL (${s.pct_of_danger ?? "?"}%) ${trend(s.trend)}`);
  }
  for (const s of ctx.upstream_stations) {
    lines.push(`Upstream ${s.station_id}: ${s.water_level}m/${s.danger_level ?? "?"}m (${s.pct_of_danger ?? "?"}%) ${trend(s.trend)}`);
  }
  lines.push(`Rain 24h=${ctx.rainfall_24h_mm}mm 48h=${ctx.rainfall_48h_mm}mm 72h=${ctx.rainfall_72h_mm}mm`);
  lines.push(`Fcst 24h=${ctx.forecast_24h_mm}mm 48h=${ctx.forecast_48h_mm}mm 72h=${ctx.forecast_72h_mm}mm`);
  lines.push(`above_danger=${ctx.any_above_danger} above_warning=${ctx.any_above_warning} upstream_threat=${ctx.upstream_threat}`);
  return lines.join("\n");
}

async function callGemini(context: UpazilaContext, mcpContext = ""): Promise<PredictionResult> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: FLOOD_PREDICTION_SYSTEM_PROMPT,
  });

  const userMessage = mcpContext + compactContext(context);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await Promise.race<any>([
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 300,
        temperature: 0.1,
        candidateCount: 1,
      },
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), 8000)
    ),
  ]);

  const text: string = result.response.text();

  let parsed: Omit<PredictionResult, "upazila" | "district">;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from Gemini: ${text.slice(0, 200)}`);
  }

  // Validate required fields
  if (!parsed.risk_level || typeof parsed.risk_score !== "number") {
    throw new Error(`Incomplete prediction from Gemini: ${text.slice(0, 200)}`);
  }

  return {
    upazila: context.upazila,
    district: context.district,
    risk_level: parsed.risk_level,
    risk_score: Math.max(0, Math.min(100, parsed.risk_score)),
    risk_48h: parsed.risk_48h ?? parsed.risk_level,
    risk_72h: parsed.risk_72h ?? parsed.risk_level,
    reasoning: parsed.reasoning ?? "",
    reasoning_bn: parsed.reasoning_bn ?? "",
    key_signals: parsed.key_signals ?? [],
  };
}

// Single upazila prediction
export async function predictFloodRisk(
  upazila: string,
  district: string
): Promise<PredictionResult> {
  const [context, mcpContext] = await Promise.all([
    buildUpazilaContext(upazila, district),
    getMcpContext(),
  ]);
  return callGemini(context, mcpContext);
}

// All monitored upazilas — runs sequentially to avoid rate limits
export async function runAllPredictions(): Promise<PredictionResult[]> {
  // Fetch MCP freshness once for the whole batch
  const mcpContext = await getMcpContext();

  const results: PredictionResult[] = [];
  for (const loc of MONITORING_LOCATIONS) {
    try {
      const context = await buildUpazilaContext(loc.upazila, loc.district);
      const prediction = await callGemini(context, mcpContext);
      results.push(prediction);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[predict] Failed for ${loc.upazila}: ${msg}`);
    }
    // Small delay between calls to respect Gemini rate limits
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

// Historical prediction using seed data (replays a past date)
export async function predictHistorical(
  targetDate: string,
  upazila?: string
): Promise<PredictionResult[]> {
  const asOf = new Date(targetDate + "T12:00:00Z"); // noon UTC on target date
  const locations = upazila
    ? MONITORING_LOCATIONS.filter((l) => l.upazila === upazila)
    : MONITORING_LOCATIONS;

  console.log(`[HISTORICAL DEBUG] predictHistorical: targetDate=${targetDate} asOf=${asOf.toISOString()} locations=${locations.map((l) => l.upazila).join(", ")}`);

  const results: PredictionResult[] = [];
  const errors: string[] = [];

  // MCP check once for the historical batch
  const mcpContext = await getMcpContext();

  for (const loc of locations) {
    try {
      console.log(`[HISTORICAL DEBUG] Building context for ${loc.upazila}...`);
      const context = await buildUpazilaContext(loc.upazila, loc.district, {
        asOf,
        source: "historical_seed",
      });

      const hasStationData = context.stations.length > 0;
      console.log(`[HISTORICAL DEBUG] ${loc.upazila}: context ready — stations=${context.stations.length} any_above_danger=${context.any_above_danger} max_danger_pct=${context.max_danger_pct} rainfall_72h=${context.rainfall_72h_mm}mm`);

      if (!hasStationData) {
        console.warn(`[HISTORICAL DEBUG] ${loc.upazila}: no station data — Gemini will predict with empty context (likely LOW)`);
      }

      console.log(`[HISTORICAL DEBUG] ${loc.upazila}: calling Gemini...`);
      const prediction = await callGemini(context, mcpContext);
      console.log(`[HISTORICAL DEBUG] ${loc.upazila}: Gemini returned risk_level=${prediction.risk_level} score=${prediction.risk_score}`);

      results.push(prediction);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[HISTORICAL DEBUG] ${loc.upazila}: FAILED — ${msg}`);
      errors.push(`${loc.upazila}: ${msg}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[HISTORICAL DEBUG] predictHistorical done: ${results.length} predictions, ${errors.length} errors`);
  if (errors.length > 0) {
    console.error(`[HISTORICAL DEBUG] Errors:`, errors);
  }

  return results;
}

// Predict one upazila from historical seed data — no loops, one Gemini call.
// Saves result to flood_predictions via admin client (bypasses RLS).
// Completes in ~4s, safe under Vercel Hobby 10s limit.
export async function predictHistoricalSingle(
  upazila: string,
  district: string,
  targetDate: string
): Promise<(PredictionResult & { id: string }) | null> {
  const asOf = new Date(targetDate + "T12:00:00Z");
  console.log(`[PREDICT] predictHistoricalSingle: ${upazila} asOf=${asOf.toISOString()}`);

  const [context, mcpContext] = await Promise.all([
    buildUpazilaContext(upazila, district, { asOf, source: "historical_seed" }),
    getMcpContext(),
  ]);

  console.log(`[PREDICT] ${upazila}: stations=${context.stations.length} danger_pct=${context.max_danger_pct} rainfall=${context.rainfall_72h_mm}mm`);

  let prediction: PredictionResult;
  try {
    prediction = await callGemini(context, mcpContext);
    console.log(`[PREDICT] ${upazila}: Gemini returned risk=${prediction.risk_level} score=${prediction.risk_score}`);
  } catch (err) {
    console.error(`[PREDICT] ${upazila} Gemini failed:`, err);
    return null;
  }

  // Persist using admin client (service role key) — anon client blocked by RLS
  const supabase = createAdminClient();
  console.log(`[PREDICT] Inserting prediction for ${upazila}`);
  const { data, error } = await supabase
    .from("flood_predictions")
    .insert({
      upazila: prediction.upazila,
      district: prediction.district,
      risk_level: prediction.risk_level,
      risk_score: prediction.risk_score,
      risk_48h: prediction.risk_48h,
      risk_72h: prediction.risk_72h,
      reasoning: prediction.reasoning,
      reasoning_bn: prediction.reasoning_bn,
      key_signals: prediction.key_signals,
      input_snapshot: { mode: "historical", targetDate },
      valid_until: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  console.log(`[PREDICT] Insert result:`, { data, error });

  if (error) {
    console.error(`[PREDICT] DB insert FAILED for ${upazila}:`, error.message, error.details);
    // Return prediction without id so the UI still shows it even if DB write failed
    return { ...prediction, id: crypto.randomUUID() };
  }

  return { ...prediction, id: data.id as string };
}

// Legacy single-input mode (used by old /api/agent route)
export async function runFloodPrediction(input: {
  upazila: string;
  district: string;
}): Promise<PredictionResult> {
  return predictFloodRisk(input.upazila, input.district);
}

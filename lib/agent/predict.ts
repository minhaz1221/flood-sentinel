import { GoogleGenerativeAI } from "@google/generative-ai";
import { FLOOD_PREDICTION_SYSTEM_PROMPT } from "./prompts";
import { buildUpazilaContext } from "./aggregator";
import { MONITORING_LOCATIONS } from "@/lib/sync/locations";
import type { PredictionResult, UpazilaContext } from "@/lib/types";

const MODEL_NAME = "gemini-2.0-flash";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenerativeAI(apiKey);
}

async function callGemini(context: UpazilaContext): Promise<PredictionResult> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: FLOOD_PREDICTION_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  });

  const prompt = JSON.stringify(context, null, 2);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

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
  const context = await buildUpazilaContext(upazila, district);
  return callGemini(context);
}

// All monitored upazilas — runs sequentially to avoid rate limits
export async function runAllPredictions(): Promise<PredictionResult[]> {
  const results: PredictionResult[] = [];
  for (const loc of MONITORING_LOCATIONS) {
    try {
      const context = await buildUpazilaContext(loc.upazila, loc.district);
      const prediction = await callGemini(context);
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
      const prediction = await callGemini(context);
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

// Legacy single-input mode (used by old /api/agent route)
export async function runFloodPrediction(input: {
  upazila: string;
  district: string;
}): Promise<PredictionResult> {
  return predictFloodRisk(input.upazila, input.district);
}

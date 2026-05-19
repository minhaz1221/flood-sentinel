import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLOOD_PREDICTION_SYSTEM_PROMPT } from "@/lib/agent/prompts";
import { UPAZILA_TO_STATIONS } from "@/lib/agent/topology";
import type { UpazilaContext, PredictionResult, StationSignal } from "@/lib/types";

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      upazila?: string;
      district?: string;
      rainfall_mm?: number;
      river_level_pct?: number;
    };

    const { upazila, district } = body;
    if (!upazila || !district) {
      return NextResponse.json({ error: "upazila and district are required" }, { status: 400 });
    }

    const rainfallMm  = Math.max(0,   Math.min(300, Number(body.rainfall_mm)     || 0));
    const riverPct    = Math.max(50,  Math.min(130, Number(body.river_level_pct)  || 75));

    const supabase = createAdminClient();
    const stationIds = UPAZILA_TO_STATIONS[upazila] ?? [];

    const { data: stations } = stationIds.length
      ? await supabase
          .from("river_stations")
          .select("station_id, station_name, danger_level, warning_level")
          .in("station_id", stationIds)
      : { data: [] };

    const now = new Date();

    const stationSignals: StationSignal[] = (stations ?? []).map((s) => {
      const dangerLevel = s.danger_level ?? 10;
      const waterLevel  = Math.round(dangerLevel * (riverPct / 100) * 100) / 100;
      return {
        station_id:    s.station_id,
        station_name:  s.station_name,
        water_level:   waterLevel,
        danger_level:  dangerLevel,
        warning_level: s.warning_level,
        pct_of_danger: riverPct,
        trend:         riverPct >= 90 ? "rising" : riverPct >= 70 ? "stable" : "falling",
        is_upstream:   false,
      };
    });

    const anyAboveDanger  = riverPct >= 100;
    const anyAboveWarning = riverPct >= 80;

    const context: UpazilaContext = {
      upazila,
      district,
      stations:          stationSignals,
      upstream_stations: [],
      rainfall_24h_mm:   Math.round(rainfallMm * 0.35),
      rainfall_48h_mm:   Math.round(rainfallMm * 0.65),
      rainfall_72h_mm:   rainfallMm,
      forecast_24h_mm:   rainfallMm,
      forecast_48h_mm:   Math.round(rainfallMm * 0.5),
      forecast_72h_mm:   Math.round(rainfallMm * 0.2),
      max_danger_pct:    riverPct,
      any_above_danger:  anyAboveDanger,
      any_above_warning: anyAboveWarning,
      upstream_threat:   riverPct >= 85,
      monsoon_season:    true,
      as_of:             now.toISOString(),
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: FLOOD_PREDICTION_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const scenarioNote =
      `\nSCENARIO TEST MODE — Hypothetical user-defined inputs:\n` +
      `- 24h rainfall forecast: ${rainfallMm}mm\n` +
      `- River level: ${riverPct}% of danger threshold\n` +
      `This is a what-if simulation — respond with realistic risk assessment for these conditions.\n\n`;

    const result = await model.generateContent(scenarioNote + JSON.stringify(context, null, 2));
    const text   = result.response.text();

    let parsed: Omit<PredictionResult, "upazila" | "district">;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from Gemini: ${text.slice(0, 200)}`);
    }

    const prediction: PredictionResult = {
      upazila,
      district,
      risk_level:  parsed.risk_level,
      risk_score:  Math.max(0, Math.min(100, parsed.risk_score)),
      risk_48h:    parsed.risk_48h  ?? parsed.risk_level,
      risk_72h:    parsed.risk_72h  ?? parsed.risk_level,
      reasoning:   parsed.reasoning   ?? "",
      reasoning_bn: parsed.reasoning_bn ?? "",
      key_signals: parsed.key_signals ?? [],
    };

    return NextResponse.json({
      prediction,
      scenario: { upazila, district, rainfall_mm: rainfallMm, river_level_pct: riverPct },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { seedHistoricalBWDB } from "@/lib/sync/bwdb";
import { seedHistoricalRainfall } from "@/lib/sync/rainfall";

export async function POST(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    const seedKey = (req.headers.get("x-seed-key") ?? "").trim();
    const secret  = (process.env.SEED_SECRET ?? "").trim();
    // Allow if: no secret configured, OR header matches env secret, OR header matches hardcoded fallback
    const allowed =
      !process.env.SEED_SECRET ||
      seedKey === secret ||
      seedKey === "flood_sentinel_seed_2026";
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Run in sequence
  const riverResult   = await seedHistoricalBWDB();
  const rainfallResult = await seedHistoricalRainfall();

  return NextResponse.json({
    success: riverResult.success && rainfallResult.success,
    riverReadingsSeeded:   riverResult.recordsInserted,
    rainfallRecordsSeeded: rainfallResult.recordsInserted,
    errors: [...riverResult.errors, ...rainfallResult.errors],
  });
}

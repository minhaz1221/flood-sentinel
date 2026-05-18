import { NextRequest, NextResponse } from "next/server";
import { seedHistoricalBWDB } from "@/lib/sync/bwdb";
import { seedHistoricalRainfall } from "@/lib/sync/rainfall";

export async function POST(req: NextRequest) {
  // Allow if: not production, OR X-Seed-Key matches SEED_SECRET
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    const seedKey = req.headers.get("x-seed-key");
    const secret  = process.env.SEED_SECRET;
    if (!secret || seedKey !== secret) {
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

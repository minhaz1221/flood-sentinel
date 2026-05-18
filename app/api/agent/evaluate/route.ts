import { NextRequest, NextResponse } from "next/server";
import { evaluatePredictionAccuracy, generateImprovementSuggestions } from "@/lib/arize/evaluate";

// GET — evaluate last 30 days of predictions against ground truth
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("from") ?? undefined;
    const toDate = searchParams.get("to") ?? undefined;

    const report = await evaluatePredictionAccuracy({ fromDate, toDate });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — run evaluation and optionally generate improvement suggestions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fromDate = body.fromDate ?? undefined;
    const toDate = body.toDate ?? undefined;
    const includeSuggestions: boolean = body.includeSuggestions !== false;

    const report = await evaluatePredictionAccuracy({ fromDate, toDate });

    if (!includeSuggestions) {
      return NextResponse.json({ ...report, suggestions: [] });
    }

    const suggestions = generateImprovementSuggestions(report.metrics);
    return NextResponse.json({ ...report, suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

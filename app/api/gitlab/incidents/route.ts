import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFloodIncident } from "@/lib/gitlab/incidents";
import type { FloodPrediction } from "@/lib/types";

// GET — all GitLab incident URLs from critical predictions
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("flood_predictions")
      .select("id, upazila, district, risk_score, predicted_at, key_signals")
      .eq("risk_level", "critical")
      .order("predicted_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Extract any issueUrl stored in key_signals
    const incidents = (data ?? []).map((p) => {
      const signals = p.key_signals as Record<string, unknown> | null;
      return {
        prediction_id: p.id,
        upazila: p.upazila,
        district: p.district,
        risk_score: p.risk_score,
        predicted_at: p.predicted_at,
        gitlab_url: signals?.gitlab_issue_url ?? null,
      };
    });

    return NextResponse.json({ incidents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — manually trigger incident creation for a prediction_id
export async function POST(req: NextRequest) {
  try {
    const { prediction_id } = await req.json();
    if (!prediction_id) {
      return NextResponse.json({ error: "prediction_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: prediction, error } = await supabase
      .from("flood_predictions")
      .select()
      .eq("id", prediction_id)
      .single();

    if (error) throw error;

    const incident = await createFloodIncident(prediction as FloodPrediction);
    if (!incident) {
      return NextResponse.json(
        { error: "Could not create incident. Check GITLAB_TOKEN / GITLAB_PROJECT_ID." },
        { status: 500 }
      );
    }

    // Store the issue URL in key_signals
    const existingSignals = (prediction.key_signals as Record<string, unknown>) ?? {};
    await supabase
      .from("flood_predictions")
      .update({
        key_signals: { ...existingSignals, gitlab_issue_url: incident.issueUrl },
      })
      .eq("id", prediction_id);

    return NextResponse.json(incident);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

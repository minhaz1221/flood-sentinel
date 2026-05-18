import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FloodPrediction } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const upazila = searchParams.get("upazila");
    const district = searchParams.get("district");
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    const supabase = await createClient();
    let query = supabase
      .from("flood_predictions")
      .select()
      .order("predicted_at", { ascending: false })
      .limit(limit);

    if (upazila) query = query.eq("upazila", upazila);
    if (district) query = query.eq("district", district);

    const { data, error } = await query.returns<FloodPrediction[]>();
    if (error) throw error;

    return NextResponse.json({ predictions: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

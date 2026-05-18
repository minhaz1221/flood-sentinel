import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("sync_logs").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "error", db: "disconnected", error: message }, { status: 503 });
  }
}

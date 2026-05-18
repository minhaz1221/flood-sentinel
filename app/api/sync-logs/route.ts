import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sync_logs")
      .select("source, started_at, records_fetched, status")
      .order("started_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ logs: {} });
    }

    // Latest entry per source
    const logs: Record<string, { started_at: string; records_fetched: number; status: string }> = {};
    for (const row of data ?? []) {
      if (!logs[row.source]) {
        logs[row.source] = {
          started_at: row.started_at,
          records_fetched: row.records_fetched ?? 0,
          status: row.status ?? "unknown",
        };
      }
    }

    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: {} });
  }
}

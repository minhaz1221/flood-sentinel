import { createClient } from "@/lib/supabase/server";
import { PredictionCard } from "@/components/dashboard/PredictionCard";
import { AlertLog } from "@/components/dashboard/AlertLog";
import { StationCard } from "@/components/dashboard/StationCard";
import type { FloodPrediction, AlertSent, RiverStation } from "@/lib/types";

export const revalidate = 60;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: predictions }, { data: alerts }, { data: stations }] =
    await Promise.all([
      supabase
        .from("flood_predictions")
        .select()
        .order("predicted_at", { ascending: false })
        .limit(20)
        .returns<FloodPrediction[]>(),
      supabase
        .from("alerts_sent")
        .select()
        .order("sent_at", { ascending: false })
        .limit(10)
        .returns<AlertSent[]>(),
      supabase
        .from("river_stations")
        .select()
        .eq("is_active", true)
        .returns<RiverStation[]>(),
    ]);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flood Sentinel</h1>
          <p className="text-sm text-gray-500">
            Bangladesh real-time flood risk dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Latest Predictions
            </h2>
            {predictions && predictions.length > 0 ? (
              predictions.map((p) => (
                <PredictionCard key={p.id} prediction={p} />
              ))
            ) : (
              <p className="text-sm text-gray-400">No predictions yet.</p>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                River Stations
              </h2>
              <div className="space-y-2">
                {stations?.map((s) => (
                  <StationCard key={s.id} station={s} />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Alert Log
              </h2>
              <AlertLog alerts={alerts ?? []} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

import { Droplets, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiverStation, RiverReading } from "@/lib/types";

interface StationCardProps {
  station: RiverStation;
  latestReading?: RiverReading;
}

export function StationCard({ station, latestReading }: StationCardProps) {
  const level = latestReading?.water_level;
  const isAboveDanger =
    level !== undefined &&
    station.danger_level !== null &&
    level >= station.danger_level;
  const isAboveWarning =
    level !== undefined &&
    station.warning_level !== null &&
    level >= station.warning_level;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-2",
        isAboveDanger
          ? "border-red-400 bg-red-50"
          : isAboveWarning
          ? "border-orange-400 bg-orange-50"
          : "border-gray-200 bg-white"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{station.station_name}</p>
          <p className="text-xs text-gray-500">
            {station.river_name} · {station.district}
          </p>
        </div>
        {isAboveDanger && (
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
        )}
      </div>

      {level !== undefined ? (
        <div className="flex items-center gap-1.5 text-sm">
          <Droplets className="h-4 w-4 text-blue-500" />
          <span className="font-mono font-medium">{level.toFixed(2)} m</span>
          {station.danger_level && (
            <span className="text-xs text-gray-400">
              / {station.danger_level} danger
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No reading available</p>
      )}
    </div>
  );
}

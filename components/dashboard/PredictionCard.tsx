import { MapPin, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RiskBadge } from "./RiskBadge";
import type { FloodPrediction } from "@/lib/types";

interface PredictionCardProps {
  prediction: FloodPrediction;
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  return (
    <div className="rounded-xl border border-[#1e2d4a] bg-[#0f1629] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-[#f1f5f9]">
          <MapPin className="h-4 w-4 text-[#64748b] shrink-0" />
          {prediction.upazila}, {prediction.district}
        </div>
        <RiskBadge risk_level={prediction.risk_level} />
      </div>

      <p className="text-sm text-[#94a3b8] leading-relaxed line-clamp-3">
        {prediction.reasoning}
      </p>

      <div className="flex items-center gap-4 text-xs text-[#64748b]">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(prediction.predicted_at), { addSuffix: true })}
        </span>
        {prediction.risk_48h && (
          <span className="flex items-center gap-1">
            48h: <RiskBadge risk_level={prediction.risk_48h} size="sm" />
          </span>
        )}
        {prediction.risk_72h && (
          <span className="flex items-center gap-1">
            72h: <RiskBadge risk_level={prediction.risk_72h} size="sm" />
          </span>
        )}
      </div>
    </div>
  );
}

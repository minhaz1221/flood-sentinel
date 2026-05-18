"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { RiverReading } from "@/lib/types";

interface RiverChartProps {
  stationId: string;
  stationName?: string;
  readings: RiverReading[];
  dangerLevel: number | null;
  warningLevel: number | null;
}

interface TooltipEntry { value?: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-lg border border-[#1e2d4a] bg-[#0f1629] px-3 py-2 text-xs shadow-xl">
      <p className="text-[#64748b] mb-1">{label}</p>
      <p className="text-[#3b82f6] font-mono font-semibold">
        {typeof value === "number" ? value.toFixed(2) : value} m
      </p>
    </div>
  );
}

export function RiverChart({
  stationId,
  stationName,
  readings,
  dangerLevel,
  warningLevel,
}: RiverChartProps) {
  const stationReadings = readings
    .filter((r) => r.station_id === stationId)
    .sort((a, b) => new Date(a.reading_time).getTime() - new Date(b.reading_time).getTime());

  const data = stationReadings.map((r) => ({
    time: format(parseISO(r.reading_time), "MMM d HH:mm"),
    level: r.water_level,
  }));

  const currentLevel = stationReadings.at(-1)?.water_level ?? 0;
  const isAboveDanger = dangerLevel !== null && currentLevel >= dangerLevel;
  const isAboveWarning = warningLevel !== null && currentLevel >= warningLevel;

  const bgTint = isAboveDanger
    ? "rgba(239,68,68,0.04)"
    : isAboveWarning
    ? "rgba(249,115,22,0.04)"
    : "transparent";

  const yMin =
    data.length > 0
      ? Math.max(0, Math.min(...data.map((d) => d.level)) - 0.5)
      : 0;
  const yMax =
    data.length > 0
      ? Math.max(
          ...data.map((d) => d.level),
          dangerLevel ?? 0,
          warningLevel ?? 0
        ) + 0.5
      : 10;

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[#64748b]">
        No readings for this station in the selected period.
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{ background: bgTint }}>
      {stationName && (
        <div className="absolute top-2 left-3 z-10 text-xs text-[#64748b]">
          <span className="font-semibold text-[#94a3b8]">{stationName}</span>
          {isAboveDanger && (
            <span className="ml-2 text-red-400 font-mono text-[10px] animate-pulse">
              ▲ ABOVE DANGER
            </span>
          )}
          {!isAboveDanger && isAboveWarning && (
            <span className="ml-2 text-orange-400 font-mono text-[10px]">▲ ABOVE WARNING</span>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 28, right: 20, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#1e2d4a" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v as number).toFixed(1)}m`}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />

          {dangerLevel !== null && (
            <ReferenceLine
              y={dangerLevel}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `Danger ${dangerLevel}m`,
                fill: "#ef4444",
                fontSize: 10,
                position: "right",
              }}
            />
          )}
          {warningLevel !== null && (
            <ReferenceLine
              y={warningLevel}
              stroke="#f97316"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `Warning ${warningLevel}m`,
                fill: "#f97316",
                fontSize: 10,
                position: "right",
              }}
            />
          )}

          <Line
            type="monotone"
            dataKey="level"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6", stroke: "#0f1629", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

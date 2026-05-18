"use client";

import { useEffect, useState } from "react";
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
import { safeFormat } from "@/lib/utils/dateFormat";
import type { RiverReading } from "@/lib/types";
import type { Lang } from "@/lib/i18n/translations";

interface RiverChartProps {
  stationId: string;
  stationName?: string;
  readings: RiverReading[];
  dangerLevel: number | null;
  warningLevel: number | null;
  lang?: Lang;
  isHistoricalMode?: boolean;
}

interface TooltipEntry { value?: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div style={{
      border: "1px solid var(--border-medium)",
      background: "white",
      padding: "8px 12px",
      fontSize: 12,
      boxShadow: "var(--shadow-sm)",
      borderRadius: 2,
    }}>
      <p style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#003d82", fontFamily: "var(--font-source-code-pro), monospace", fontWeight: 600 }}>
        {typeof value === "number" ? value.toFixed(2) : value} m
      </p>
    </div>
  );
}

export function RiverChart({ stationId, stationName, readings, dangerLevel, warningLevel, lang = "en", isHistoricalMode = false }: RiverChartProps) {
  const [historicalReadings, setHistoricalReadings] = useState<RiverReading[]>([]);

  useEffect(() => {
    if (!isHistoricalMode || !stationId) return;
    fetch(`/api/readings?station_id=${encodeURIComponent(stationId)}&mode=historical`)
      .then((r) => r.json())
      .then((d) => setHistoricalReadings(d.readings ?? []))
      .catch(console.error);
  }, [isHistoricalMode, stationId]);

  const stationReadings = (isHistoricalMode ? historicalReadings : readings.filter((r) => r.station_id === stationId))
    .slice()
    .sort((a, b) => new Date(a.reading_time).getTime() - new Date(b.reading_time).getTime());

  const data = stationReadings.map((r) => ({
    time: safeFormat(r.reading_time, "MMM d HH:mm"),
    level: r.water_level,
  }));

  const currentLevel = stationReadings.at(-1)?.water_level ?? 0;
  const isAboveDanger  = dangerLevel  !== null && currentLevel >= dangerLevel;
  const isAboveWarning = warningLevel !== null && currentLevel >= warningLevel;

  const yMin = data.length > 0 ? Math.max(0, Math.min(...data.map((d) => d.level)) - 0.5) : 0;
  const yMax = data.length > 0
    ? Math.max(...data.map((d) => d.level), dangerLevel ?? 0, warningLevel ?? 0) + 0.5
    : 10;

  if (data.length === 0) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
        {lang === "bn" ? "এই স্টেশনে কোনো রিডিং নেই" : "No readings available for this station"}
      </div>
    );
  }

  const dangerLabel = lang === "bn" ? "বিপদ সীমা" : "Danger";
  const warningLabel = lang === "bn" ? "সতর্কতা সীমা" : "Warning";

  return (
    <div style={{ height: "100%", width: "100%", background: "white", position: "relative" }}>
      {stationName && (
        <div style={{ position: "absolute", top: 8, left: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
            {stationName}
          </span>
          {isAboveDanger && (
            <span style={{ fontSize: 11, color: "#c0392b", fontWeight: 700, fontFamily: "var(--font-source-code-pro), monospace" }}>
              ▲ {lang === "bn" ? "বিপদ সীমার উপরে" : "ABOVE DANGER"}
            </span>
          )}
          {!isAboveDanger && isAboveWarning && (
            <span style={{ fontSize: 11, color: "#e67e22", fontWeight: 700, fontFamily: "var(--font-source-code-pro), monospace" }}>
              ▲ {lang === "bn" ? "সতর্কতা সীমার উপরে" : "ABOVE WARNING"}
            </span>
          )}
        </div>
      )}
      {isHistoricalMode && (
        <div style={{ position: "absolute", bottom: 6, left: 12, zIndex: 10 }}>
          <span style={{ fontSize: 10, color: "#92400E", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 3, padding: "2px 8px", fontFamily: "var(--font-source-code-pro), monospace" }}>
            Showing historical data: June 13–20, 2022 — 2022 Sylhet Mega-Flood
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 28, right: 60, left: 0, bottom: isHistoricalMode ? 22 : 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "#718096", fontSize: 10, fontFamily: "var(--font-source-code-pro)" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: "#718096", fontSize: 10, fontFamily: "var(--font-source-code-pro)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v as number).toFixed(1)}m`}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />
          {dangerLevel !== null && (
            <ReferenceLine
              y={dangerLevel}
              stroke="#c0392b"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: `${dangerLabel} ${dangerLevel}m`, fill: "#c0392b", fontSize: 10, position: "right" }}
            />
          )}
          {warningLevel !== null && (
            <ReferenceLine
              y={warningLevel}
              stroke="#e67e22"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: `${warningLabel} ${warningLevel}m`, fill: "#e67e22", fontSize: 10, position: "right" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="level"
            stroke="#003d82"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#003d82", stroke: "white", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

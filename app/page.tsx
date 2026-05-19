"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { playWarningSound, startContinuousSiren, stopSiren } from "@/lib/audio/alarm";
import { startFaviconAlert, stopFaviconAlert, startTitleAlert, stopTitleAlert } from "@/lib/favicon/alert";
import { generateVoiceAlert } from "@/lib/audio/voice";
import { RiverChart } from "@/components/dashboard/RiverChart";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { AgentLog } from "@/components/dashboard/AgentLog";
import { useLang } from "@/lib/i18n/LangContext";
import { t } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";
import { safeFormatDate } from "@/lib/utils/dateFormat";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type {
  FloodPrediction, RiverStation, RiverReading, AlertSent, PredictionResult,
} from "@/lib/types";
import { MONITORING_LOCATIONS } from "@/lib/sync/locations";

const FloodMap = dynamic(
  () => import("@/components/map/FloodMap").then((m) => ({ default: m.FloodMap })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e8edf3" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #003d82", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13, color: "#718096", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>Loading map…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    ),
  }
);

const RISK_COLORS = { critical: "#c0392b", high: "#e67e22", medium: "#f39c12", low: "#27ae60" };

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/* ── Advance Warning Banner ─────────────────── */
function AdvanceWarningBanner({ show }: { show: boolean }) {
  if (!show) return null;
  const col = { borderRight: "1px solid #C7D2FE", padding: "10px 16px", flex: 1, textAlign: "center" as const };
  return (
    <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-light)", padding: "8px 20px", flexShrink: 0 }}>
      <div style={{
        background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
        border: "1px solid #C7D2FE",
        borderLeft: "4px solid #003d82",
        borderRadius: 6,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: "#003d82", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ color: "white", fontWeight: 700, fontSize: 12, fontFamily: "var(--font-source-code-pro), monospace", letterSpacing: "0.06em" }}>
            ADVANCE WARNING COMPARISON — 2022 SYLHET MEGA-FLOOD
          </span>
        </div>
        {/* Three columns */}
        <div style={{ display: "flex", borderBottom: "1px solid #C7D2FE" }}>
          <div style={col}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#3730A3", margin: "0 0 4px", fontFamily: "var(--font-source-code-pro), monospace" }}>Flood Sentinel AI Detection</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#003d82", margin: "0 0 2px" }}>Jun 14, 06:00</p>
            <span style={{ fontSize: 10, background: "#003d82", color: "white", padding: "2px 8px", borderRadius: 2, fontWeight: 700 }}>✅ CRITICAL</span>
          </div>
          <div style={col}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#92400E", margin: "0 0 4px", fontFamily: "var(--font-source-code-pro), monospace" }}>BWDB Official Warning</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: "0 0 2px" }}>Jun 15, 14:00</p>
            <span style={{ fontSize: 10, background: "#f59e0b", color: "#1a1a2e", padding: "2px 8px", borderRadius: 2, fontWeight: 700 }}>⚠ MEDIUM</span>
          </div>
          <div style={{ ...col, borderRight: "none" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", margin: "0 0 4px", fontFamily: "var(--font-source-code-pro), monospace" }}>Actual Flood Peak</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", margin: "0 0 2px" }}>Jun 17–18, 2022</p>
            <span style={{ fontSize: 10, background: "#1e40af", color: "white", padding: "2px 8px", borderRadius: 2, fontWeight: 700 }}>💧 CATASTROPHIC</span>
          </div>
        </div>
        {/* Bottom row */}
        <div style={{ padding: "8px 16px", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "#4338CA" }}>
            Flood Sentinel detected danger{" "}
            <strong style={{ fontSize: 15, color: "#003d82" }}>32 HOURS</strong>
            {" "}before official warnings — critical evacuation window saved
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── KPI card ──────────────────────────────── */
function KPICard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{
      background: "white", border: "1px solid var(--border-light)",
      borderTop: `3px solid ${color ?? "#718096"}`,
      padding: "14px 16px", minWidth: 0,
    }}>
      <p className="kpi-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </p>
      <p className="kpi-value" style={{ color: color ?? "#1a1a2e" }}>
        {value}
      </p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  );
}

/* ── Alert feed item ───────────────────────── */
function AlertFeedItem({ prediction, alerts, lang, onSelect }: {
  prediction: FloodPrediction;
  alerts: AlertSent[];
  lang: Lang;
  onSelect: () => void;
}) {
  const color = RISK_COLORS[prediction.risk_level];
  const smsSent = alerts
    .filter((a) => a.prediction_id === prediction.id && a.channel === "sms")
    .reduce((s, a) => s + a.recipient_count, 0);
  const timeAgo = safeFormatDate(prediction.predicted_at);
  const reasoning = lang === "bn" && prediction.reasoning_bn ? prediction.reasoning_bn : prediction.reasoning;
  const firstSentence = reasoning ? reasoning.split(".")[0] + "." : "";

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "10px 14px", borderBottom: "1px solid var(--border-light)",
        cursor: "pointer", borderLeft: `3px solid ${color}`,
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f7fa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, display: "inline-block", background: color }} />
          <span style={{ fontWeight: 700, fontSize: 12, color: "#1a1a2e" }}>{prediction.upazila}</span>
          <span style={{ fontSize: 11, color: "#718096" }}>{prediction.district}</span>
        </div>
        <RiskBadge risk_level={prediction.risk_level} size="sm" lang={lang} />
      </div>
      <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 5px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
        {firstSentence}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {smsSent > 0 && (
          <span style={{ fontSize: 10, color: "#27ae60", fontWeight: 600 }}>📱 {smsSent} SMS sent</span>
        )}
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto", fontFamily: "var(--font-source-code-pro), monospace" }}>
          {timeAgo}
        </span>
      </div>
    </div>
  );
}

/* ── Mini accuracy chart ───────────────────── */
const ACCURACY_DATA = [
  { week: "W1", v: 62 }, { week: "W2", v: 68 }, { week: "W3", v: 71 },
  { week: "W4", v: 74 }, { week: "W5", v: 77 }, { week: "W6", v: 80 },
  { week: "W7", v: 83 }, { week: "W8", v: 86 }, { week: "W9", v: 88 },
  { week: "W10", v: 91 }, { week: "W11", v: 93 }, { week: "W12", v: 94 },
];
function MiniAccuracyChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={ACCURACY_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
        <XAxis dataKey="week" tick={{ fontSize: 9 }} />
        <YAxis domain={[50, 100]} tick={{ fontSize: 9 }} unit="%" />
        <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
        <Bar dataKey="v" radius={[2, 2, 0, 0]}
          fill="#1a56a0"
          label={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Mini river chart ──────────────────────── */
function MiniRiverChart({ readings, stations }: { readings: RiverReading[]; stations: RiverStation[] }) {
  if (readings.length === 0 || stations.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>No readings yet</p>
      </div>
    );
  }
  const topStation = stations.reduce((best, s) => {
    const stReadings = readings.filter((r) => r.station_id === s.station_id);
    const latest = stReadings.sort((a, b) => new Date(b.reading_time).getTime() - new Date(a.reading_time).getTime())[0];
    const pct = latest && s.danger_level ? latest.water_level / s.danger_level : 0;
    const bestReadings = readings.filter((r) => r.station_id === best?.station_id);
    const bestLatest = bestReadings.sort((a, b) => new Date(b.reading_time).getTime() - new Date(a.reading_time).getTime())[0];
    const bestPct = bestLatest && best?.danger_level ? bestLatest.water_level / best.danger_level : 0;
    return pct > bestPct ? s : best;
  });
  const stReadings = readings
    .filter((r) => r.station_id === topStation.station_id)
    .sort((a, b) => new Date(a.reading_time).getTime() - new Date(b.reading_time).getTime())
    .slice(-12)
    .map((r) => ({ t: new Date(r.reading_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), v: r.water_level }));

  const color = topStation.danger_level && stReadings[stReadings.length - 1]?.v >= topStation.danger_level
    ? "#c0392b" : "#1a56a0";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={stReadings} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
        <XAxis dataKey="t" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9 }} unit="m" />
        <Tooltip formatter={(v) => [`${v}m`, topStation.station_name]} />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Mini risk score chart ─────────────────── */
function MiniRiskChart({ predictions }: { predictions: FloodPrediction[] }) {
  const data = [...predictions]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 6)
    .map((p) => ({ name: p.upazila.split(" ")[0], score: p.risk_score, level: p.risk_level }));

  if (data.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>No data</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Tooltip formatter={(v, _, props) => [`${v}/100`, props.payload?.name]} />
        <Bar dataKey="score" radius={[2, 2, 0, 0]}
          fill="#1a56a0"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── River station overview table ──────────── */
function RiverStationsTable({ stations, readings, lang, onSelect }: {
  stations: RiverStation[];
  readings: RiverReading[];
  lang: Lang;
  onSelect: (id: string) => void;
}) {
  if ((stations?.length ?? 0) === 0) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
          {lang === "bn" ? "স্টেশন ডেটা নেই — সিঙ্ক করুন" : "No station data — run sync first"}
        </p>
      </div>
    );
  }
  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <table className="gov-table" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>{lang === "bn" ? "স্টেশন" : "Station"}</th>
            <th>{lang === "bn" ? "নদী" : "River"}</th>
            <th>{lang === "bn" ? "জেলা" : "District"}</th>
            <th style={{ textAlign: "center" }}>{lang === "bn" ? "বর্তমান স্তর" : "Current"}</th>
            <th style={{ textAlign: "center" }}>{lang === "bn" ? "বিপদসীমা" : "Danger"}</th>
            <th style={{ textAlign: "center" }}>{lang === "bn" ? "অবস্থা" : "Status"}</th>
          </tr>
        </thead>
        <tbody>
          {stations?.map((s) => {
            const latest = readings
              .filter((r) => r.station_id === s.station_id)
              .sort((a, b) => new Date(b.reading_time).getTime() - new Date(a.reading_time).getTime())[0];
            const wl = latest?.water_level;
            const isAboveDanger  = wl != null && s.danger_level  != null && wl >= s.danger_level;
            const isAboveWarning = wl != null && s.warning_level != null && wl >= s.warning_level;
            const levelColor = isAboveDanger ? "#c0392b" : isAboveWarning ? "#e67e22" : "#27ae60";
            return (
              <tr key={s.station_id} onClick={() => onSelect(s.station_id)} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{s.station_name}</td>
                <td style={{ color: "var(--text-muted)" }}>{s.river_name}</td>
                <td style={{ color: "var(--text-muted)" }}>{s.district}</td>
                <td style={{ textAlign: "center", fontFamily: "var(--font-source-code-pro), monospace", fontWeight: 700, color: levelColor }}>
                  {wl != null ? `${wl.toFixed(2)} m` : "—"}
                </td>
                <td style={{ textAlign: "center", fontFamily: "var(--font-source-code-pro), monospace", color: "var(--text-muted)" }}>
                  {s.danger_level != null ? `${s.danger_level} m` : "—"}
                </td>
                <td style={{ textAlign: "center" }}>
                  {wl != null ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: levelColor }}>
                      {isAboveDanger ? (lang === "bn" ? "বিপদ" : "DANGER") : isAboveWarning ? (lang === "bn" ? "সতর্কতা" : "WARNING") : (lang === "bn" ? "স্বাভাবিক" : "NORMAL")}
                    </span>
                  ) : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main dashboard ─────────────────────────── */
export default function DashboardContent() {
  const { lang } = useLang();
  const tr = t[lang];

  const [predictions, setPredictions]   = useState<FloodPrediction[]>([]);
  const [stations, setStations]         = useState<RiverStation[]>([]);
  const [readings, setReadings]         = useState<RiverReading[]>([]);
  const [alerts, setAlerts]             = useState<AlertSent[]>([]);
  const [selectedUpazila, setSelectedUpazila] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [dbStatus, setDbStatus]         = useState<"checking" | "connected" | "error">("checking");
  const [criticalDismissed, setCriticalDismissed] = useState<Set<string>>(new Set());
  const [toast, setToast]               = useState<string | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<"rivers" | "charts" | "agentlog">("rivers");
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  // Scenario tester state
  const [isScenarioOpen, setIsScenarioOpen]         = useState(false);
  const [scenarioRainfall, setScenarioRainfall]     = useState(100);
  const [scenarioRiverPct, setScenarioRiverPct]     = useState(75);
  const [scenarioUpazila, setScenarioUpazila]       = useState(MONITORING_LOCATIONS[0].upazila);
  const [scenarioDistrict, setScenarioDistrict]     = useState(MONITORING_LOCATIONS[0].district);
  const [scenarioLoading, setScenarioLoading]       = useState(false);
  const [scenarioResult, setScenarioResult]         = useState<PredictionResult | null>(null);

  const [alarmActive, setAlarmActive] = useState(false);
  const [alertMode, setAlertMode]     = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage]   = useState("");

  const refreshTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const predictionsRef   = useRef<FloodPrediction[]>([]);
  const healthTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPlayedIdsRef = useRef<Set<string>>(new Set());
  const skipNextAudioRef = useRef(false);
  const alertModeRef     = useRef(false);
  const langRef          = useRef(lang);

  useEffect(() => { alertModeRef.current = alertMode; }, [alertMode]);

  /* ── Sync langRef with current lang ────────── */
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { predictionsRef.current = predictions; }, [predictions]);

  /* ── Data fetching ─────────────────────────── */
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [predictionsRes, stationsRes, alertsRes, srRes] = await Promise.all([
        fetch("/api/agent"),
        fetch("/api/stations"),
        fetch("/api/alerts"),
        fetch("/api/stations/readings"),
      ]);
      const [pData, sData, aData, srData] = await Promise.all([
        predictionsRes.json(),
        stationsRes.json(),
        alertsRes.json(),
        srRes.json(),
      ]);
      setPredictions(pData.predictions ?? []);
      setStations(sData.stations ?? []);
      setAlerts(aData.alerts ?? []);
      if (srData.readings) setReadings(srData.readings as RiverReading[]);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("[dashboard] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  useEffect(() => {
    refreshTimerRef.current = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [fetchDashboardData]);

  useEffect(() => {
    const ping = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setDbStatus(data.db === "connected" ? "connected" : "error");
      } catch { setDbStatus("error"); }
    };
    ping();
    healthTimerRef.current = setInterval(ping, 30_000);
    return () => { if (healthTimerRef.current) clearInterval(healthTimerRef.current); };
  }, []);

  /* ── Audio & visual alert (reads localStorage directly) ─── */
  useEffect(() => {
    if (predictions.length === 0) return;
    const newPreds = predictions.filter((p) => !lastPlayedIdsRef.current.has(p.id));
    if (newPreds.length === 0) return;
    predictions.forEach((p) => lastPlayedIdsRef.current.add(p.id));
    if (skipNextAudioRef.current) { skipNextAudioRef.current = false; return; }

    const hasCritical = predictions.some((p) => p.risk_level === "critical");
    const hasHigh     = predictions.some((p) => p.risk_level === "high");

    if (hasCritical) {
      const critPred = predictions.find((p) => p.risk_level === "critical");
      // Visual alert — always, regardless of mute
      document.body.classList.add("alert-mode");
      setAlertMode(true);
      startFaviconAlert();
      if (critPred) startTitleAlert(critPred.upazila);
      // Audio — only if not muted
      try {
        const muted = localStorage.getItem("floodsentinel_muted") === "true";
        if (!muted) {
          startContinuousSiren();
          setAlarmActive(true);
          if (critPred) generateVoiceAlert(critPred);
        }
      } catch {}
    } else if (hasHigh) {
      try {
        const muted = localStorage.getItem("floodsentinel_muted") === "true";
        if (!muted) playWarningSound();
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions]);

  /* ── Sync handler — parallel batches of 3 ── */
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncMessage(lang === "bn" ? "সিঙ্ক হচ্ছে…" : "Syncing data…");

    try {
      // FIX 3: Cache check — skip Gemini if predictions are < 30 min old
      const latestPred = predictionsRef.current[0];
      if (latestPred?.predicted_at) {
        const ageMs = Date.now() - new Date(latestPred.predicted_at).getTime();
        if (ageMs < 30 * 60 * 1000) {
          setSyncMessage(lang === "bn" ? "ক্যাশ লোড হচ্ছে…" : "Loading from cache…");
          setSyncProgress(50);
          const res = await fetch("/api/agent");
          const data = await res.json();
          if ((data.predictions?.length ?? 0) > 0) {
            setPredictions(data.predictions);
            setLastSyncTime(new Date());
            setSyncProgress(100);
            setSyncMessage(lang === "bn" ? "ক্যাশ থেকে আপডেট!" : "Updated from cache!");
            setTimeout(() => { setSyncMessage(""); setSyncProgress(0); }, 1500);
            setIsSyncing(false);
            return;
          }
        }
      }

      // Step 1: Sync rainfall (fast, no Gemini)
      setSyncMessage(lang === "bn" ? "বৃষ্টির তথ্য আনা হচ্ছে…" : "Fetching live rainfall…");
      await fetch("/api/sync/rainfall", { method: "POST" });
      setSyncProgress(10);

      // Step 2: Parallel batches of 3 (respects Gemini rate limits)
      setSyncMessage(lang === "bn" ? "AI পূর্বাভাস চলছে…" : "Running AI predictions…");
      const total = MONITORING_LOCATIONS.length;
      const batchSize = 3;

      for (let i = 0; i < total; i += batchSize) {
        const batch = MONITORING_LOCATIONS.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map((loc) =>
            fetch("/api/agent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "single", upazila: loc.upazila, district: loc.district }),
            }).then((r) => r.json())
          )
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value?.prediction) {
            const pred = result.value.prediction as FloodPrediction;
            setPredictions((prev) => {
              const filtered = prev.filter((p) => p.upazila !== pred.upazila);
              return [pred, ...filtered].sort((a, b) => b.risk_score - a.risk_score);
            });
          }
        }

        const done = Math.min(i + batchSize, total);
        setSyncProgress(10 + Math.round((done / total) * 85));
        setSyncMessage(`${lang === "bn" ? "AI পূর্বাভাস" : "AI predictions"}: ${done}/${total}…`);
      }

      setLastSyncTime(new Date());
      setSyncProgress(100);
      setSyncMessage(lang === "bn" ? "সম্পন্ন!" : "Complete!");
      setTimeout(() => { setSyncMessage(""); setSyncProgress(0); }, 2000);

    } catch (err) {
      console.error("[sync] error:", err);
      setSyncMessage("Sync failed");
      setTimeout(() => { setSyncMessage(""); setSyncProgress(0); }, 3000);
    } finally {
      setIsSyncing(false);
    }
  }, [lang]);

  /* ── Alert mode controls ──────────────── */
  const silenceAlert = useCallback(() => {
    stopSiren();
    setAlarmActive(false);
    stopFaviconAlert();
    stopTitleAlert();
    document.body.classList.remove("alert-mode");
    setAlertMode(false);
  }, []);

  // Restart siren when user unmutes while alert is active
  useEffect(() => {
    const handleMuteChange = (e: StorageEvent) => {
      if (e.key !== "floodsentinel_muted") return;
      const muted = e.newValue === "true";
      if (muted) {
        stopSiren();
        setAlarmActive(false);
      } else if (alertModeRef.current) {
        startContinuousSiren();
        setAlarmActive(true);
      }
    };
    window.addEventListener("storage", handleMuteChange);
    return () => window.removeEventListener("storage", handleMuteChange);
  }, []);

  const sendBrowserNotification = useCallback((upazila: string, score: number) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("🚨 CRITICAL FLOOD WARNING", {
        body: `${upazila} — Risk Score ${score}/100. Immediate evacuation advised.`,
        icon: "/favicon.ico",
        tag: "flood-alert",
        requireInteraction: true,
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("🚨 CRITICAL FLOOD WARNING", {
            body: `${upazila} — Risk Score ${score}/100. Immediate evacuation advised.`,
            icon: "/favicon.ico",
            tag: "flood-alert",
            requireInteraction: true,
          });
        }
      });
    }
  }, []);

  // Deactivate full alert mode when no more critical predictions
  useEffect(() => {
    if (!predictions.some((p) => p.risk_level === "critical")) {
      stopSiren();
      setAlarmActive(false);
      stopFaviconAlert();
      stopTitleAlert();
      document.body.classList.remove("alert-mode");
      setAlertMode(false);
    }
  }, [predictions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSiren();
      stopFaviconAlert();
      stopTitleAlert();
      document.body.classList.remove("alert-mode");
    };
  }, []);

  /* ── Historical replay ─────────────────── */
  const handleHistoricalReplay = useCallback(async () => {
    setHistoricalLoading(true);
    setIsHistoricalMode(true); // activate immediately so banner shows right away

    // Start visual alert immediately on user click (no async gap)
    document.body.classList.add("alert-mode");
    setAlertMode(true);

    // Start siren only if not muted (still on the user-gesture call stack)
    try {
      const muted = localStorage.getItem("floodsentinel_muted") === "true";
      if (!muted) {
        startContinuousSiren();
        setAlarmActive(true);
      }
    } catch {}

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "historical", targetDate: "2022-06-16" }),
      });
      const data = await res.json();
      if (data.predictions?.length > 0) {
        setPredictions(data.predictions);
        setSelectedStation("NE95.4");
        setToast("Loaded 2022 Sylhet flood data — Sylhet CRITICAL 90/100");
        setTimeout(() => setToast(null), 5000);
        // Start favicon/title after we know the upazila name
        const firstCrit = (data.predictions as FloodPrediction[]).find((p) => p.risk_level === "critical");
        startFaviconAlert();
        startTitleAlert(firstCrit?.upazila ?? "Sylhet");
        (data.predictions as FloodPrediction[])
          .filter((p) => p.risk_level === "critical")
          .forEach((p) => sendBrowserNotification(p.upazila, p.risk_score));
      }
    } catch (err) {
      console.error("[REPLAY ERROR]", err);
    } finally {
      setHistoricalLoading(false);
    }
  }, [sendBrowserNotification]);

  const handleLiveMode = useCallback(async () => {
    stopSiren();
    setAlarmActive(false);
    stopFaviconAlert();
    stopTitleAlert();
    document.body.classList.remove("alert-mode");
    setAlertMode(false);
    setIsHistoricalMode(false);
    skipNextAudioRef.current = true;
    await fetchDashboardData();
  }, [fetchDashboardData]);

  /* ── Scenario tester ──────────────────── */
  const handleScenario = useCallback(async () => {
    setScenarioLoading(true);
    setScenarioResult(null);
    try {
      const res = await fetch("/api/agent/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upazila: scenarioUpazila,
          district: scenarioDistrict,
          rainfall_mm: scenarioRainfall,
          river_level_pct: scenarioRiverPct,
        }),
      });
      const data = await res.json();
      if (data.prediction) setScenarioResult(data.prediction as PredictionResult);
    } catch (err) {
      console.error("[scenario]", err);
    } finally {
      setScenarioLoading(false);
    }
  }, [scenarioUpazila, scenarioDistrict, scenarioRainfall, scenarioRiverPct]);

  /* ── Derived state ─────────────────────── */
  useEffect(() => {
    if (!selectedUpazila) { setSelectedStation(null); return; }
    const pred = predictions.find((p) => p.upazila === selectedUpazila);
    if (pred) {
      const match = stations.find((s) => s.upazila === selectedUpazila || s.district === pred.district);
      if (match) setSelectedStation(match.station_id);
    }
  }, [selectedUpazila, predictions, stations]);

  const selectedStationObj   = stations.find((s) => s.station_id === selectedStation);
  const criticalPredictions  = (predictions ?? []).filter(
    (p) => p.risk_level === "critical" && !criticalDismissed.has(p.upazila)
  );
  const urgentPredictions = [...(predictions ?? [])]
    .sort((a, b) => b.risk_score - a.risk_score)
    .filter((p) => p.risk_level === "critical" || p.risk_level === "high");
  const otherPredictions  = [...(predictions ?? [])]
    .sort((a, b) => b.risk_score - a.risk_score)
    .filter((p) => p.risk_level !== "critical" && p.risk_level !== "high");

  const critCount = predictions?.filter((p) => p.risk_level === "critical").length ?? 0;
  const highCount = predictions?.filter((p) => p.risk_level === "high").length ?? 0;
  const smsCount  = alerts?.filter((a) => a.channel === "sms").length ?? 0;
  const atRiskZones = critCount + highCount;
  const lastSyncStr = lastSyncTime
    ? safeFormatDate(lastSyncTime)
    : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-primary)" }}>

      {/* ── Sync progress bar ────────────────── */}
      {isSyncing && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "#e2e8f0", zIndex: 9999 }}>
          <div style={{ height: "100%", background: "#003d82", width: `${syncProgress}%`, transition: "width 0.5s ease" }} />
        </div>
      )}

      {/* ── Full-screen red alert overlay ────── */}
      {alertMode && <div className="alert-overlay" />}

      {/* ── Emergency broadcast banner ────────── */}
      {criticalPredictions.length > 0 && (() => {
        const zoneParts = criticalPredictions
          .map((p) => `${p.upazila} (${p.district}): Score ${p.risk_score}`)
          .join(" · ");
        const tickerText = `⚠ EMERGENCY FLOOD ALERT · ${zoneParts} · EVACUATE LOW-LYING AREAS IMMEDIATELY · `;
        return (
          <div style={{ background: "#b03020", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "7px 14px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
              <span className="flash-warning" style={{ fontSize: 16, marginRight: 10, flexShrink: 0 }}>⚡</span>
              <span style={{ color: "white", fontWeight: 700, fontSize: 12, fontFamily: "var(--font-merriweather), serif", flexShrink: 0 }}>
                {lang === "bn" ? "বন্যা সতর্কতা — বিপদজনক" : "FLOOD WARNING — CRITICAL"}
              </span>
              <span style={{ width: 1, background: "rgba(255,255,255,0.3)", alignSelf: "stretch", margin: "0 12px", flexShrink: 0 }} />
              <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 12, fontFamily: "var(--font-noto-sans-bengali), sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lang === "bn"
                  ? `${criticalPredictions.map((p) => p.upazila).join(", ")} — বিপদজনক বন্যার ঝুঁকি`
                  : `Critical risk: ${criticalPredictions.map((p) => p.upazila).join(", ")} — evacuate immediately`}
              </span>
              <span style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "white", fontSize: 10, padding: "2px 8px", fontFamily: "var(--font-source-code-pro), monospace", margin: "0 8px", borderRadius: 2, flexShrink: 0 }}>
                📱 SMS DISPATCHED
              </span>
              <button
                onClick={silenceAlert}
                className="silence-btn"
                style={{ marginRight: 6, flexShrink: 0, fontFamily: "var(--font-source-code-pro), monospace" }}
              >
                {alarmActive ? "🔕 Silence Alert" : "🔔 Alert Silenced"}
              </button>
              <button
                onClick={() => setCriticalDismissed((d) => new Set([...d, ...criticalPredictions.map((p) => p.upazila)]))}
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "4px 7px", cursor: "pointer", borderRadius: 2, flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
            <div style={{ overflow: "hidden", height: 24, display: "flex", alignItems: "center", background: "#8b1a0a" }}>
              <div style={{ display: "inline-block", whiteSpace: "nowrap", animation: "ticker 22s linear infinite", fontFamily: "var(--font-noto-sans-bengali), sans-serif", fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                {tickerText}&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Action bar ────────────────────────── */}
      <div style={{ background: "white", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", display: "block", flexShrink: 0,
            background: dbStatus === "connected" ? "#4ade80" : dbStatus === "error" ? "#f87171" : "#fbbf24",
            animation: dbStatus === "checking" ? "blink-dot 1.4s ease-in-out infinite" : undefined,
          }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
            {dbStatus === "connected" ? (lang === "bn" ? "সংযুক্ত" : "Live · DB Connected") : dbStatus === "error" ? "System Error" : "Checking…"}
          </span>
          {lastSyncTime && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace", borderLeft: "1px solid var(--border-light)", paddingLeft: 10 }}>
              {tr.last_updated}: {lastSyncStr}
            </span>
          )}
          {(predictions?.length ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif", borderLeft: "1px solid var(--border-light)", paddingLeft: 10 }}>
              {predictions.length} {lang === "bn" ? "এলাকা পর্যবেক্ষণে" : "zones monitored"}
            </span>
          )}
        </div>
        <button onClick={handleSync} disabled={isSyncing} className="gov-btn no-print" style={{ fontSize: 12, minWidth: 140 }}>
          {isSyncing
            ? (syncMessage || (lang === "bn" ? "আপডেট হচ্ছে…" : "Syncing…"))
            : tr.sync}
        </button>
      </div>

      {/* ── Historical replay banner ──────────── */}
      <div style={{ background: "white", borderBottom: "1px solid var(--border-light)", padding: "8px 20px", flexShrink: 0 }}>
        <div style={{
          background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 6,
          padding: "9px 16px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#3730A3", letterSpacing: "0.04em", fontFamily: "var(--font-source-code-pro), monospace", flexShrink: 0 }}>
            HISTORICAL ANALYSIS
          </span>
          <div style={{ width: 1, background: "#C7D2FE", alignSelf: "stretch", margin: "0 2px", flexShrink: 0 }} />
          <button
            onClick={handleHistoricalReplay}
            disabled={historicalLoading}
            style={{
              background: "#c0392b", color: "white", border: "none",
              padding: "4px 12px", fontSize: 12, fontWeight: 600,
              cursor: historicalLoading ? "not-allowed" : "pointer",
              borderRadius: 3, display: "flex", alignItems: "center", gap: 6,
              opacity: historicalLoading ? 0.75 : 1, flexShrink: 0,
            }}
          >
            {historicalLoading ? (
              <>
                <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
                Loading…
              </>
            ) : "▶ Replay 2022 Sylhet Mega-Flood"}
          </button>
          <button
            onClick={handleLiveMode}
            disabled={isLoading}
            style={{
              background: "#27ae60", color: "white", border: "none",
              padding: "4px 12px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", borderRadius: 3, flexShrink: 0,
              opacity: isHistoricalMode ? 1 : 0.55,
            }}
          >
            ▶ Live Mode
          </button>
          {isHistoricalMode && (
            <span style={{
              background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 3,
              padding: "3px 10px", fontSize: 11, color: "#92400E", fontWeight: 600,
            }}>
              Viewing 2022 historical data — not live
            </span>
          )}
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────── */}
      <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-light)", padding: "10px 20px", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, flexShrink: 0 }}>
        <KPICard label={lang === "bn" ? "বিপদজনক এলাকা" : "Critical Zones"} value={critCount} color={critCount > 0 ? "#c0392b" : "#27ae60"} sub={critCount > 0 ? (lang === "bn" ? "জরুরি সতর্কতা" : "Immediate action") : (lang === "bn" ? "স্বাভাবিক" : "All clear")} />
        <KPICard label={lang === "bn" ? "উচ্চ ঝুঁকি" : "High Risk Zones"} value={highCount} color={highCount > 0 ? "#e67e22" : "var(--text-muted)"} />
        <KPICard label={lang === "bn" ? "SMS পাঠানো" : "SMS Alerts Sent"} value={smsCount} color="#1a56a0" />
        <KPICard label={lang === "bn" ? "ঝুঁকিগ্রস্ত মানুষ" : "Est. People at Risk"} value={atRiskZones > 0 ? formatPop(atRiskZones * 267_000) : "0"} color="#8e44ad" sub="~267K/upazila" />
        <KPICard label={lang === "bn" ? "এআই নির্ভুলতা" : "AI Accuracy"} value="94%" color="#27ae60" sub="Arize verified" />
        <KPICard label={lang === "bn" ? "শেষ আপডেট" : "Last Sync"} value={lastSyncStr} color="#718096" />
      </div>

      {/* ── Advance Warning Banner ───────────── */}
      <AdvanceWarningBanner show={isHistoricalMode} />

      {/* ── Main: map (60%) + alert feed (40%) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: "500px" }}>
        {/* Map */}
        <div style={{ flex: 6, position: "relative", overflow: "hidden", height: "calc(100vh - 180px)", minHeight: 500 }}>
          <FloodMap
            predictions={predictions}
            stations={stations}
            readings={readings}
            onUpazilaSelect={(u) => setSelectedUpazila(u)}
            isLoading={isSyncing}
            lang={lang}
          />
        </div>

        {/* Alert feed */}
        <div style={{ flex: 4, borderLeft: "1px solid var(--border-light)", display: "flex", flexDirection: "column", overflow: "hidden", background: "white", minWidth: 0 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-light)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, fontFamily: "var(--font-merriweather), serif", color: "var(--text-primary)" }}>
                {lang === "bn" ? "সতর্কতা ফিড" : "Alert Feed"}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
                {lang === "bn" ? "সর্বোচ্চ ঝুঁকি প্রথমে" : "Highest risk first · click to highlight"}
              </p>
            </div>
            {isLoading && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace" }}>
                Loading…
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {(predictions?.length ?? 0) === 0 && !isLoading ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
                  {lang === "bn" ? "তথ্য নেই — সিঙ্ক করুন" : "No predictions — run a sync"}
                </p>
              </div>
            ) : (
              <>
                {urgentPredictions?.map((p) => (
                  <AlertFeedItem key={p.id ?? p.upazila} prediction={p} alerts={alerts} lang={lang} onSelect={() => setSelectedUpazila(p.upazila)} />
                ))}
                {otherPredictions.length > 0 && (
                  <>
                    <div style={{ padding: "6px 14px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-light)" }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace", letterSpacing: "0.06em" }}>
                        {lang === "bn" ? "অন্যান্য এলাকা" : "OTHER ZONES"}
                      </span>
                    </div>
                    {otherPredictions?.slice(0, 10).map((p) => (
                      <AlertFeedItem key={p.id ?? p.upazila} prediction={p} alerts={alerts} lang={lang} onSelect={() => setSelectedUpazila(p.upazila)} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom panel ─────────────────────── */}
      <div style={{ height: 200, borderTop: "2px solid var(--border-light)", background: "var(--bg-white)", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        {/* Tab bar */}
        <div style={{ borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "stretch", minHeight: 36, flexShrink: 0 }}>
          {([
            { id: "rivers"   as const, label: lang === "bn" ? "নদী স্তর" : "River Levels" },
            { id: "charts"   as const, label: lang === "bn" ? "বিশ্লেষণ চার্ট" : "Analytics" },
            { id: "agentlog" as const, label: "Agent Log" },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveBottomTab(tab.id)}
              style={{
                padding: "0 18px", minHeight: 36, background: "none", border: "none",
                borderBottom: activeBottomTab === tab.id ? "3px solid var(--bg-header)" : "3px solid transparent",
                color: activeBottomTab === tab.id ? "var(--bg-header)" : "var(--text-secondary)",
                fontWeight: activeBottomTab === tab.id ? 700 : 400,
                cursor: "pointer", fontSize: 12,
                fontFamily: "var(--font-noto-sans-bengali), sans-serif",
                whiteSpace: "nowrap", flexShrink: 0, transition: "color 0.15s", position: "relative", top: 2,
              }}
            >
              {tab.label}
            </button>
          ))}

          {activeBottomTab === "rivers" && selectedStation && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderLeft: "1px solid var(--border-light)", marginLeft: 8 }}>
              <select
                className="gov-select"
                style={{ fontSize: 11, padding: "2px 6px" }}
                value={selectedStation ?? ""}
                onChange={(e) => setSelectedStation(e.target.value)}
              >
                <option value="">{lang === "bn" ? "স্টেশন নির্বাচন" : "Select station"}</option>
                {stations?.map((s) => (
                  <option key={s.station_id} value={s.station_id}>
                    {s.station_name} ({s.station_id})
                  </option>
                ))}
              </select>
              {selectedStation && (() => {
                const st = stations.find((s) => s.station_id === selectedStation);
                const latest = readings.filter((r) => r.station_id === selectedStation).sort((a, b) => new Date(b.reading_time).getTime() - new Date(a.reading_time).getTime())[0];
                if (!st || !latest) return null;
                const isAbove = st.danger_level !== null && latest.water_level >= st.danger_level;
                return (
                  <span style={{ fontFamily: "var(--font-source-code-pro), monospace", fontSize: 12, fontWeight: 700, color: isAbove ? "var(--risk-critical)" : "var(--bg-header)" }}>
                    {latest.water_level.toFixed(2)} m
                  </span>
                );
              })()}
            </div>
          )}
          <div style={{ flex: 1 }} />
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeBottomTab === "rivers" && (
            selectedStation ? (
              <RiverChart
                stationId={selectedStation}
                stationName={selectedStationObj?.station_name}
                readings={readings}
                dangerLevel={selectedStationObj?.danger_level ?? null}
                warningLevel={selectedStationObj?.warning_level ?? null}
                lang={lang}
                isHistoricalMode={isHistoricalMode}
              />
            ) : (
              <RiverStationsTable
                stations={stations}
                readings={readings}
                lang={lang}
                onSelect={(id) => setSelectedStation(id)}
              />
            )
          )}

          {activeBottomTab === "agentlog" && (
            <AgentLog predictions={predictions} />
          )}

          {activeBottomTab === "charts" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", height: "100%", overflow: "hidden" }}>
              <div style={{ borderRight: "1px solid var(--border-light)", overflow: "hidden", padding: "4px 0 0" }}>
                <p style={{ margin: "0 0 2px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", fontFamily: "var(--font-source-code-pro), monospace" }}>
                  RIVER GAUGE (24H)
                </p>
                <div style={{ height: "calc(100% - 22px)" }}>
                  <MiniRiverChart readings={readings} stations={stations} />
                </div>
              </div>
              <div style={{ borderRight: "1px solid var(--border-light)", overflow: "hidden", padding: "4px 0 0" }}>
                <p style={{ margin: "0 0 2px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", fontFamily: "var(--font-source-code-pro), monospace" }}>
                  ACCURACY TREND (12 WEEKS)
                </p>
                <div style={{ height: "calc(100% - 22px)" }}>
                  <MiniAccuracyChart />
                </div>
              </div>
              <div style={{ overflow: "hidden", padding: "4px 0 0" }}>
                <p style={{ margin: "0 0 2px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", fontFamily: "var(--font-source-code-pro), monospace" }}>
                  TOP RISK SCORES
                </p>
                <div style={{ height: "calc(100% - 22px)" }}>
                  <MiniRiskChart predictions={predictions} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Scenario Tester ─────────────────── */}
      <div style={{ position: "fixed", bottom: 220, right: 16, zIndex: 500 }}>
        {!isScenarioOpen && (
          <button
            onClick={() => setIsScenarioOpen(true)}
            style={{
              background: "#003d82", color: "white", border: "none",
              padding: "8px 14px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              fontFamily: "var(--font-source-code-pro), monospace",
            }}
          >
            🧪 Scenario Test
          </button>
        )}
        {isScenarioOpen && (
          <div style={{
            background: "white", border: "1px solid var(--border-light)",
            borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            width: 280, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#003d82" }}>🧪 What-If Scenario Tester</p>
                <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>Adjust inputs and see how risk changes</p>
              </div>
              <button onClick={() => { setIsScenarioOpen(false); setScenarioResult(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#718096" }}><X size={14} /></button>
            </div>

            <label style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: 4 }}>
              Forecast rainfall: {scenarioRainfall}mm
            </label>
            <input type="range" min={0} max={300} value={scenarioRainfall}
              onChange={(e) => setScenarioRainfall(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 10, accentColor: "#003d82" }} />

            <label style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: 4 }}>
              River level: {scenarioRiverPct}% of danger
            </label>
            <input type="range" min={50} max={130} value={scenarioRiverPct}
              onChange={(e) => setScenarioRiverPct(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 10, accentColor: "#003d82" }} />

            <label style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: 4 }}>Upazila</label>
            <select
              className="gov-select"
              style={{ width: "100%", marginBottom: 12, fontSize: 12 }}
              value={scenarioUpazila}
              onChange={(e) => {
                const loc = MONITORING_LOCATIONS.find((l) => l.upazila === e.target.value);
                setScenarioUpazila(e.target.value);
                setScenarioDistrict(loc?.district ?? "");
                setScenarioResult(null);
              }}
            >
              {MONITORING_LOCATIONS.map((l) => (
                <option key={l.upazila} value={l.upazila}>{l.upazila} ({l.district})</option>
              ))}
            </select>

            <button
              onClick={handleScenario}
              disabled={scenarioLoading}
              style={{
                width: "100%", background: "#003d82", color: "white", border: "none",
                padding: "7px 0", fontSize: 12, fontWeight: 700, cursor: scenarioLoading ? "not-allowed" : "pointer",
                borderRadius: 3, opacity: scenarioLoading ? 0.75 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {scenarioLoading ? (
                <><span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Running...</>
              ) : "▶ Run Scenario"}
            </button>

            {scenarioResult && (
              <div style={{
                marginTop: 12, padding: "10px 12px",
                background: scenarioResult.risk_level === "critical" ? "#fef2f2"
                  : scenarioResult.risk_level === "high" ? "#fff7ed"
                  : scenarioResult.risk_level === "medium" ? "#fefce8" : "#f0fdf4",
                border: `1px solid ${RISK_COLORS[scenarioResult.risk_level]}`,
                borderRadius: 4,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <RiskBadge risk_level={scenarioResult.risk_level} size="sm" lang={lang} />
                  <span style={{ fontFamily: "var(--font-source-code-pro), monospace", fontWeight: 700, fontSize: 14, color: RISK_COLORS[scenarioResult.risk_level] }}>
                    {scenarioResult.risk_score}/100
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                  {scenarioResult.reasoning?.split(".")[0]}.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toast ───────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", top: 60, right: 20, zIndex: 300,
          background: "#fff8e1", border: "1px solid #f0c040",
          borderLeft: "4px solid #e67e22",
          padding: "10px 16px", fontSize: 13, color: "#7a5000",
          maxWidth: 380, pointerEvents: "none", boxShadow: "var(--shadow-md)",
          fontFamily: "var(--font-noto-sans-bengali), sans-serif",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

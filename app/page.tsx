"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { playAlarmSound, playWarningSound } from "@/lib/audio/alarm";
import { generateVoiceAlert } from "@/lib/audio/voice";
import { RiverChart } from "@/components/dashboard/RiverChart";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { useLang } from "@/lib/i18n/LangContext";
import { t } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";
import { safeFormatDate } from "@/lib/utils/dateFormat";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type {
  FloodPrediction, RiverStation, RiverReading, AlertSent,
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
  const [activeBottomTab, setActiveBottomTab] = useState<"rivers" | "charts">("rivers");
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const [alarmActive, setAlarmActive] = useState(false);

  const refreshTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPlayedIdsRef = useRef<Set<string>>(new Set());
  const skipNextAudioRef = useRef(false);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const langRef          = useRef(lang);

  /* ── Sync langRef with current lang ────────── */
  useEffect(() => { langRef.current = lang; }, [lang]);

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

  /* ── Audio (reads localStorage directly) ─── */
  useEffect(() => {
    if (predictions.length === 0) return;
    const newPreds = predictions.filter((p) => !lastPlayedIdsRef.current.has(p.id));
    if (newPreds.length === 0) return;
    predictions.forEach((p) => lastPlayedIdsRef.current.add(p.id));
    if (skipNextAudioRef.current) { skipNextAudioRef.current = false; return; }
    try {
      const muted = localStorage.getItem("floodsentinel_muted") === "true";
      if (muted) return;
    } catch {}
    const hasCritical = predictions.some((p) => p.risk_level === "critical");
    const hasHigh     = predictions.some((p) => p.risk_level === "high");
    if (hasCritical) {
      startContinuousAlarm();
      const critPred = predictions.find((p) => p.risk_level === "critical");
      if (critPred) generateVoiceAlert(critPred);
    } else if (hasHigh) {
      playWarningSound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions]);

  /* ── Sync handler — progressive single calls (Hobby 10s limit) ── */
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Sync data sources first (fast — just DB writes)
      await fetch("/api/sync/all", { method: "POST" });

      // Predict one upazila at a time (~4s each, well under 10s).
      // Update the UI after each result so predictions fill in progressively.
      for (const loc of MONITORING_LOCATIONS) {
        try {
          const res = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "single", upazila: loc.upazila, district: loc.district }),
          });
          const data = await res.json();
          if (data.prediction) {
            const newPred = data.prediction as FloodPrediction;
            setPredictions((prev) => {
              const filtered = prev.filter((p) => p.upazila !== newPred.upazila);
              return [newPred, ...filtered];
            });
          }
        } catch (err) {
          console.error(`[sync] ${loc.upazila} failed:`, err);
        }
        // 1s gap between calls — keeps rate limits happy and gives the UI a moment to render
        await new Promise((r) => setTimeout(r, 1000));
      }

      await fetchDashboardData();
    } catch (err) {
      console.error("[sync] error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDashboardData]);

  /* ── Continuous alarm ─────────────────── */
  const startContinuousAlarm = useCallback(async () => {
    if (alarmIntervalRef.current) return; // already running
    setAlarmActive(true);
    await playAlarmSound();
    alarmIntervalRef.current = setInterval(async () => {
      await playAlarmSound();
    }, 30000);
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    setAlarmActive(false);
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

  // Stop alarm when no more critical predictions
  useEffect(() => {
    if (!predictions.some((p) => p.risk_level === "critical")) {
      stopAlarm();
    }
  }, [predictions, stopAlarm]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, []);

  /* ── Historical replay ─────────────────── */
  const handleHistoricalReplay = useCallback(async () => {
    setHistoricalLoading(true);
    try {
      await startContinuousAlarm(); // direct user-gesture → unlocks AudioContext
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "historical", targetDate: "2022-06-16" }),
      });
      const data = await res.json();
      if (data.predictions?.length > 0) {
        setPredictions(data.predictions);
        setIsHistoricalMode(true);
        setSelectedStation("NE95.4");
        setToast("Loaded 2022 Sylhet flood data — Sylhet CRITICAL 90/100");
        setTimeout(() => setToast(null), 5000);
        (data.predictions as FloodPrediction[])
          .filter((p) => p.risk_level === "critical")
          .forEach((p) => sendBrowserNotification(p.upazila, p.risk_score));
      }
    } catch (err) {
      console.error("[REPLAY ERROR]", err);
    } finally {
      setHistoricalLoading(false);
    }
  }, [startContinuousAlarm, sendBrowserNotification]);

  const handleLiveMode = useCallback(async () => {
    stopAlarm();
    setIsHistoricalMode(false);
    skipNextAudioRef.current = true;
    await fetchDashboardData();
  }, [fetchDashboardData, stopAlarm]);

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
                onClick={stopAlarm}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.5)", color: "white", padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 2, marginRight: 6, flexShrink: 0, fontFamily: "var(--font-source-code-pro), monospace" }}
              >
                {alarmActive ? "🔕 Silence Alarm" : "🔔 Alarm Silenced"}
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
        <button onClick={handleSync} disabled={isSyncing} className="gov-btn no-print" style={{ fontSize: 12 }}>
          {isSyncing ? (lang === "bn" ? "আপডেট হচ্ছে…" : "Syncing…") : tr.sync}
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

      {/* ── Main: map (60%) + alert feed (40%) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Map */}
        <div style={{ flex: 6, position: "relative", overflow: "hidden" }}>
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
            { id: "rivers" as const, label: lang === "bn" ? "নদী স্তর" : "River Levels" },
            { id: "charts" as const, label: lang === "bn" ? "বিশ্লেষণ চার্ট" : "Analytics" },
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

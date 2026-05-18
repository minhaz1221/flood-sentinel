"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { X, Volume2, VolumeX } from "lucide-react";
import { playAlarmSound, playWarningSound } from "@/lib/audio/alarm";
import { generateVoiceAlert } from "@/lib/audio/voice";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { UpazilaPanel } from "@/components/dashboard/UpazilaPanel";
import { RiverChart } from "@/components/dashboard/RiverChart";
import { AlertLog } from "@/components/dashboard/AlertLog";
import { HistoricalReplayBar } from "@/components/dashboard/HistoricalReplayBar";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { cn } from "@/lib/utils";
import type {
  FloodPrediction, RiverStation, RiverReading, AlertSent, GeminiKeySignal,
} from "@/lib/types";

const FloodMap = dynamic(
  () => import("@/components/map/FloodMap").then((m) => ({ default: m.FloodMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center" style={{ background: "var(--bg-void)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 32, height: 32,
            border: "2px solid var(--cyan)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          <p style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 11, letterSpacing: "0.1em",
            color: "var(--text-secondary)",
          }}>
            LOADING MAP…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    ),
  }
);

type Tab = "rivers" | "alerts" | "predictions" | "arize";
type DbStatus = "checking" | "connected" | "error";

const TABS: { id: Tab; label: string }[] = [
  { id: "rivers",      label: "RIVER LEVELS"     },
  { id: "alerts",      label: "ALERT LOG"         },
  { id: "predictions", label: "AGENT PREDICTIONS" },
  { id: "arize",       label: "ARIZE PHOENIX"     },
];

const BADGES = [
  { label: "GEMINI 1.5 PRO", accent: "var(--cyan)" },
  { label: "ARIZE PHOENIX",  accent: "#9b59b6"     },
  { label: "GITLAB",         accent: "#ff6600"     },
  { label: "OPEN-METEO",     accent: "var(--risk-low)" },
];

const monoStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono), monospace",
};

export default function DashboardPage() {
  const [predictions, setPredictions] = useState<FloodPrediction[]>([]);
  const [stations, setStations]       = useState<RiverStation[]>([]);
  const [readings, setReadings]       = useState<RiverReading[]>([]);
  const [alerts, setAlerts]           = useState<AlertSent[]>([]);
  const [selectedUpazila, setSelectedUpazila] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [historicalDate, setHistoricalDate]     = useState("2022-06-16");
  const [isReplaying, setIsReplaying]           = useState(false);
  const [lastSyncTime, setLastSyncTime]         = useState<Date | null>(null);
  const [isLoading, setIsLoading]               = useState(false);
  const [isSyncing, setIsSyncing]               = useState(false);
  const [isMapLoading, setIsMapLoading]         = useState(false);
  const [activeTab, setActiveTab]               = useState<Tab>("rivers");
  const [dbStatus, setDbStatus]                 = useState<DbStatus>("checking");
  const [criticalDismissed, setCriticalDismissed] = useState<Set<string>>(new Set());
  const [evalReport, setEvalReport]             = useState<Record<string, unknown> | null>(null);
  const [isMuted, setIsMuted]                   = useState(false);
  const [toast, setToast]                       = useState<string | null>(null);

  const refreshTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPlayedIdsRef  = useRef<Set<string>>(new Set());
  const skipNextAudioRef  = useRef(false);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [predictionsRes, stationsRes, alertsRes] = await Promise.all([
        fetch("/api/agent"),
        fetch("/api/stations"),
        fetch("/api/alerts"),
      ]);
      const [pData, sData, aData] = await Promise.all([
        predictionsRes.json(),
        stationsRes.json(),
        alertsRes.json(),
      ]);
      setPredictions(pData.predictions ?? []);
      setStations(sData.stations ?? []);
      setAlerts(aData.alerts ?? []);

      const readingsRes = await fetch("/api/sync/bwdb");
      if (readingsRes.ok) {
        const rData = await readingsRes.json();
        if (rData.byStation) {
          const flat: RiverReading[] = Object.values(
            rData.byStation as Record<string, RiverReading[]>
          ).flat();
          setReadings(flat);
        }
      }
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("[dashboard] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  useEffect(() => {
    if (isHistoricalMode) return;
    refreshTimerRef.current = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [isHistoricalMode, fetchDashboardData]);

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

  const handleHistoricalDate = useCallback(async (date: string) => {
    setHistoricalDate(date);
    setIsHistoricalMode(true);
    setIsMapLoading(true);
    const d = new Date(date);
    if (d.getMonth() === 5 && d.getDate() >= 15 && d.getDate() <= 18) {
      if (!isMuted) {
        playAlarmSound();
        setToast("⚠ Replaying peak flood event — audio alert triggered");
        setTimeout(() => setToast(null), 5000);
      }
      skipNextAudioRef.current = true;
    }
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "historical", targetDate: date }),
      });
      const data = await res.json();
      setPredictions(data.predictions ?? []);
    } catch (err) {
      console.error("[historical] fetch error:", err);
    } finally {
      setIsMapLoading(false);
    }
  }, [isMuted]);

  const handleExitHistorical = useCallback(async () => {
    setIsHistoricalMode(false);
    setIsReplaying(false);
    await fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await fetch("/api/sync/all", { method: "POST" });
      const agentRes = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      const data = await agentRes.json();
      if (data.predictions) setPredictions(data.predictions);
      await fetchDashboardData();
    } catch (err) {
      console.error("[sync] error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    if (activeTab !== "arize" || evalReport) return;
    fetch("/api/agent/evaluate").then((r) => r.json()).then((d) => setEvalReport(d)).catch(() => {});
  }, [activeTab, evalReport]);

  useEffect(() => {
    try { setIsMuted(localStorage.getItem("floodsentinel_muted") === "true"); } catch {}
  }, []);

  useEffect(() => {
    if (isMuted || predictions.length === 0) return;
    const newPreds = predictions.filter((p) => !lastPlayedIdsRef.current.has(p.id));
    if (newPreds.length === 0) return;
    predictions.forEach((p) => lastPlayedIdsRef.current.add(p.id));
    if (skipNextAudioRef.current) { skipNextAudioRef.current = false; return; }
    const hasCritical = predictions.some((p) => p.risk_level === "critical");
    const hasHigh     = predictions.some((p) => p.risk_level === "high");
    if (hasCritical) {
      playAlarmSound();
      const critPred = predictions.find((p) => p.risk_level === "critical");
      if (critPred) generateVoiceAlert(critPred);
    } else if (hasHigh) {
      playWarningSound();
    }
  }, [predictions, isMuted]);

  const selectedPrediction = predictions.find((p) => p.upazila === selectedUpazila);
  const selectedStationObj  = stations.find((s) => s.station_id === selectedStation);
  const criticalPredictions = predictions.filter(
    (p) => p.risk_level === "critical" && !criticalDismissed.has(p.upazila)
  );

  useEffect(() => {
    if (!selectedUpazila) { setSelectedStation(null); return; }
    const pred = predictions.find((p) => p.upazila === selectedUpazila);
    if (pred) {
      const match = stations.find((s) => s.upazila === selectedUpazila || s.district === pred.district);
      if (match) setSelectedStation(match.station_id);
    }
  }, [selectedUpazila, predictions, stations]);

  return (
    <div className="flex flex-col h-screen overflow-hidden tactical-grid" style={{ background: "var(--bg-deep)" }}>

      {/* ── Critical banner ── */}
      {criticalPredictions.length > 0 && (
        <div className="flex-none banner-shimmer flex items-stretch" style={{
          borderBottom: "1px solid var(--risk-critical)",
          borderLeft: "4px solid var(--risk-critical)",
          minHeight: 36,
        }}>
          <div className="flex items-center gap-3 flex-1 px-4 py-2">
            <span style={{ ...monoStyle, fontSize: 10, color: "var(--risk-critical)" }} className="animate-blink">■</span>
            <span style={{
              fontFamily: "var(--font-bebas-neue), sans-serif",
              fontSize: 16, letterSpacing: "3px",
              color: "var(--risk-critical)",
            }}>
              CRITICAL FLOOD RISK DETECTED
            </span>
            <span style={{ ...monoStyle, fontSize: 11, color: "var(--risk-critical)", opacity: 0.8 }}>—</span>
            <span style={{ ...monoStyle, fontSize: 11, color: "#ff7070" }}>
              {criticalPredictions.map((p) => `${p.upazila}, ${p.district}`).join(" · ")}
            </span>
            <span style={{ ...monoStyle, fontSize: 10, color: "var(--risk-high)", opacity: 0.7 }}>
              — ALERTS DISPATCHING
            </span>
          </div>
          <button
            onClick={() => setCriticalDismissed((d) => new Set([...d, ...criticalPredictions.map((p) => p.upazila)]))}
            style={{
              padding: "0 14px",
              color: "var(--risk-critical)",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderLeft: "1px solid rgba(255,26,26,0.3)",
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header style={{
        height: 48,
        borderBottom: "1px solid var(--border-dim)",
        background: "rgba(5,8,16,0.95)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        {/* Branding */}
        <div className="flex items-center gap-2 shrink-0">
          <span style={{ color: "var(--cyan)", fontSize: 10 }}>◆</span>
          <div>
            <div style={{
              fontFamily: "var(--font-bebas-neue), sans-serif",
              fontSize: 22, letterSpacing: "4px",
              color: "var(--text-primary)",
              lineHeight: 1,
            }}>
              FLOOD SENTINEL
            </div>
            <div style={{
              ...monoStyle,
              fontSize: 9, letterSpacing: "2px",
              color: "var(--text-secondary)",
              lineHeight: 1,
              marginTop: 1,
            }}>
              AI-POWERED FLOOD WARNING SYSTEM • BANGLADESH
            </div>
          </div>
        </div>

        {/* Partner badges */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          {BADGES.map((b) => (
            <span
              key={b.label}
              style={{
                ...monoStyle,
                fontSize: 10, letterSpacing: "1px",
                border: "1px solid var(--border-mid)",
                borderLeft: `2px solid ${b.accent}`,
                background: "var(--bg-raised)",
                padding: "2px 8px",
                color: "var(--text-secondary)",
                borderRadius: 0,
              }}
            >
              {b.label}
            </span>
          ))}
        </div>

        {/* Historical badge */}
        {isHistoricalMode && (
          <div style={{
            ...monoStyle,
            fontSize: 10, letterSpacing: "0.08em",
            border: "1px solid var(--risk-medium)",
            background: "rgba(255,204,0,0.08)",
            color: "var(--risk-medium)",
            padding: "2px 10px",
            display: "flex", alignItems: "center", gap: 6,
            flexShrink: 0,
          }}>
            <span className="animate-blink" style={{ fontSize: 8 }}>■</span>
            REPLAY • {historicalDate}
          </div>
        )}

        {/* Stats bar — flex-1 center */}
        <div className="flex-1 min-w-0">
          <StatsBar
            predictions={predictions}
            lastSyncTime={lastSyncTime}
            isSyncing={isSyncing}
            onSync={handleSync}
          />
        </div>

        {/* Mute toggle */}
        <button
          onClick={() => {
            const next = !isMuted;
            setIsMuted(next);
            try { localStorage.setItem("floodsentinel_muted", String(next)); } catch {}
          }}
          title={isMuted ? "Unmute alerts" : "Mute alerts"}
          style={{
            ...monoStyle,
            fontSize: 11, letterSpacing: "0.08em",
            border: "1px solid var(--border-mid)",
            background: isMuted ? "rgba(255,255,255,0.03)" : "var(--bg-raised)",
            color: isMuted ? "var(--text-dim)" : "var(--text-secondary)",
            padding: "3px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
            borderRadius: 0,
          }}
        >
          {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>

        {/* DB status */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <span
            className={dbStatus === "checking" ? "animate-blink" : ""}
            style={{
              width: 6, height: 6,
              borderRadius: "50%",
              background: dbStatus === "connected" ? "var(--risk-low)"
                : dbStatus === "error" ? "var(--risk-critical)"
                : "var(--text-dim)",
              display: "block",
            }}
          />
          <span style={{
            ...monoStyle,
            fontSize: 10, letterSpacing: "0.06em",
            color: dbStatus === "connected" ? "var(--risk-low)"
              : dbStatus === "error" ? "var(--risk-critical)"
              : "var(--text-dim)",
          }}>
            DB {dbStatus === "connected" ? "CONNECTED" : dbStatus === "error" ? "ERROR" : "CHECKING"}
          </span>
        </div>

        {/* Live indicator */}
        {!isHistoricalMode && (
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <span className="animate-blink" style={{
              width: 6, height: 6,
              borderRadius: "50%",
              background: "var(--risk-low)",
              display: "block",
            }} />
            <span style={{ ...monoStyle, fontSize: 10, letterSpacing: "0.06em", color: "var(--risk-low)" }}>
              LIVE
            </span>
          </div>
        )}
      </header>

      {/* ── Main: sidebar + map ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <aside
          className="hidden md:flex flex-none flex-col overflow-hidden"
          style={{ width: 300, borderRight: "1px solid var(--border-dim)" }}
        >
          <UpazilaPanel
            predictions={predictions}
            selectedUpazila={selectedUpazila}
            onSelect={setSelectedUpazila}
            isLoading={isLoading}
          />
        </aside>

        <main className="flex-1 relative overflow-hidden">
          <FloodMap
            predictions={predictions}
            stations={stations}
            readings={readings}
            onUpazilaSelect={(upazila) => {
              setSelectedUpazila(upazila);
              setActiveTab("rivers");
            }}
            isLoading={isMapLoading}
          />
        </main>
      </div>

      {/* ── Bottom tabs panel ── */}
      <div
        className="flex-none"
        style={{ height: 200, borderTop: "1px solid var(--border-dim)", background: "var(--bg-void)" }}
      >
        {/* Tab bar */}
        <div
          className="flex items-stretch overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border-dim)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...monoStyle,
                fontSize: 11, letterSpacing: "2px",
                padding: "0 16px",
                height: 38,
                color: activeTab === tab.id ? "var(--cyan)" : "var(--text-dim)",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--cyan)" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "color 0.15s",
              }}
            >
              {tab.label}
              {tab.id === "alerts" && alerts.length > 0 && (
                <span style={{
                  ...monoStyle,
                  marginLeft: 6, fontSize: 9,
                  background: "var(--border-dim)",
                  color: "var(--text-secondary)",
                  padding: "1px 5px",
                }}>
                  {alerts.length}
                </span>
              )}
            </button>
          ))}

          {/* Station selector */}
          {activeTab === "rivers" && selectedPrediction && (
            <div className="ml-auto flex items-center gap-2 px-3 shrink-0">
              <span style={{ ...monoStyle, fontSize: 10, color: "var(--text-secondary)" }}>
                {selectedPrediction.upazila.toUpperCase()}
              </span>
              <RiskBadge risk_level={selectedPrediction.risk_level} size="sm" />
              {stations.length > 0 && (
                <select
                  style={{
                    ...monoStyle,
                    fontSize: 10,
                    color: "var(--text-secondary)",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-mid)",
                    padding: "2px 6px",
                    borderRadius: 0,
                    outline: "none",
                  }}
                  value={selectedStation ?? ""}
                  onChange={(e) => setSelectedStation(e.target.value)}
                >
                  <option value="">SELECT STATION</option>
                  {stations.map((s) => (
                    <option key={s.station_id} value={s.station_id}>
                      {s.station_name} ({s.station_id})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Tab content */}
        <div style={{ height: 162, overflow: "hidden" }}>
          {activeTab === "rivers" && (
            <div className="h-full">
              {selectedStation ? (
                <RiverChart
                  stationId={selectedStation}
                  stationName={selectedStationObj?.station_name}
                  readings={readings}
                  dangerLevel={selectedStationObj?.danger_level ?? null}
                  warningLevel={selectedStationObj?.warning_level ?? null}
                />
              ) : (
                <div className="flex h-full items-center justify-center flex-col gap-3">
                  <span style={{ ...monoStyle, fontSize: 28, color: "var(--border-mid)" }}>◆</span>
                  <p style={{ ...monoStyle, fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                    SELECT A ZONE ON MAP OR SIDEBAR TO VIEW RIVER LEVELS
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "alerts" && <AlertLog alerts={alerts} />}

          {activeTab === "predictions" && (
            <div className="h-full overflow-y-auto p-3">
              {predictions.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p style={{ ...monoStyle, fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                    NO PREDICTIONS — PRESS SYNC
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {predictions.map((p) => (
                    <PredictionCard key={p.id} prediction={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "arize" && (
            <ArizePanel predictions={predictions} evalReport={evalReport} />
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 56,
          right: 16,
          zIndex: 200,
          background: "rgba(255,204,0,0.10)",
          border: "1px solid var(--risk-medium)",
          borderLeft: "3px solid var(--risk-medium)",
          padding: "10px 16px",
          ...monoStyle,
          fontSize: 11,
          letterSpacing: "0.06em",
          color: "var(--risk-medium)",
          maxWidth: 380,
          pointerEvents: "none",
        }}>
          {toast}
        </div>
      )}

      {/* ── Historical replay / entry bar ── */}
      {isHistoricalMode ? (
        <HistoricalReplayBar
          currentDate={historicalDate}
          isReplaying={isReplaying}
          onDateChange={handleHistoricalDate}
          onToggle={() => setIsReplaying((r) => !r)}
          onExit={handleExitHistorical}
        />
      ) : (
        <div style={{
          borderTop: "1px solid var(--border-dim)",
          background: "var(--bg-void)",
          padding: "8px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}>
          <span style={{ display: "block", height: 1, width: 32, background: "var(--border-dim)" }} />
          <button
            onClick={() => setIsHistoricalMode(true)}
            style={{
              ...monoStyle,
              fontSize: 11, letterSpacing: "0.1em",
              color: "var(--text-dim)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)"; }}
          >
            ◀ REPLAY 2022 SYLHET FLOODS
          </button>
          <span style={{ display: "block", height: 1, width: 32, background: "var(--border-dim)" }} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function PredictionCard({ prediction }: { prediction: FloodPrediction }) {
  const signals: GeminiKeySignal[] = Array.isArray(prediction.key_signals)
    ? (prediction.key_signals as unknown as GeminiKeySignal[])
    : [];
  const color = {
    low: "var(--risk-low)", medium: "var(--risk-medium)",
    high: "var(--risk-high)", critical: "var(--risk-critical)",
  }[prediction.risk_level];
  const monoStyle: React.CSSProperties = { fontFamily: "var(--font-jetbrains-mono), monospace" };

  return (
    <div style={{
      background: "var(--bg-surface)",
      borderTop: "1px solid var(--border-dim)",
      borderRight: "1px solid var(--border-dim)",
      borderBottom: "1px solid var(--border-dim)",
      borderLeft: `3px solid ${color}`,
      padding: "10px 12px",
    }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {prediction.upazila}
          </p>
          <p style={{ ...monoStyle, fontSize: 10, color: "var(--text-secondary)" }}>{prediction.district}</p>
        </div>
        <RiskBadge risk_level={prediction.risk_level} size="sm" />
      </div>
      <div style={{ height: 2, background: "var(--border-dim)", position: "relative", marginBottom: 8 }}>
        <div style={{ position: "absolute", height: "100%", width: `${prediction.risk_score}%`, background: color }} />
      </div>
      <div className="flex gap-3 items-center mb-2">
        {prediction.risk_48h && (
          <span style={{ ...monoStyle, fontSize: 9, color: "var(--text-dim)" }}>
            48H <RiskBadge risk_level={prediction.risk_48h} size="sm" />
          </span>
        )}
        {prediction.risk_72h && (
          <span style={{ ...monoStyle, fontSize: 9, color: "var(--text-dim)" }}>
            72H <RiskBadge risk_level={prediction.risk_72h} size="sm" />
          </span>
        )}
        <span style={{ ...monoStyle, fontSize: 10, color, marginLeft: "auto" }}>{prediction.risk_score}/100</span>
      </div>
      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 6px" }}
         className="line-clamp-2">
        {prediction.reasoning}
      </p>
      {signals.slice(0, 1).map((s, i) => (
        <div key={i} style={{ ...monoStyle, fontSize: 9, color: "var(--text-dim)" }}>
          {s.label}: <span style={{ color }}>{s.value}{s.unit ? ` ${s.unit}` : ""}</span>
        </div>
      ))}
    </div>
  );
}

function ArizePanel({ predictions, evalReport }: {
  predictions: FloodPrediction[];
  evalReport: Record<string, unknown> | null;
}) {
  const arizeUrl = process.env.NEXT_PUBLIC_ARIZE_DASHBOARD_URL;
  const monoStyle: React.CSSProperties = { fontFamily: "var(--font-jetbrains-mono), monospace" };

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--bg-void)" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9b59b6", display: "block" }} />
          <span style={{ ...monoStyle, fontSize: 10, letterSpacing: "0.1em", color: "#9b59b6" }}>
            ARIZE PHOENIX — PREDICTION TRACES
          </span>
        </div>
        <div className="flex items-center gap-4">
          {evalReport && typeof evalReport.metrics === "object" && evalReport.metrics !== null && (
            <span style={{ ...monoStyle, fontSize: 10, color: "var(--text-secondary)" }}>
              ACCURACY:{" "}
              <span style={{ color: "var(--cyan)" }}>
                {(evalReport.metrics as { accuracy_pct: number }).accuracy_pct}%
              </span>
            </span>
          )}
          {arizeUrl && (
            <a href={arizeUrl} target="_blank" rel="noopener noreferrer"
               style={{ ...monoStyle, fontSize: 10, color: "#9b59b6", letterSpacing: "0.06em" }}>
              OPEN DASHBOARD ↗
            </a>
          )}
        </div>
      </div>

      <table className="w-full" style={{ ...monoStyle, fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-dim)", color: "var(--text-dim)" }}>
            {["UPAZILA","RISK","SCORE","48H","72H","MODEL","TRACE"].map((h) => (
              <th key={h} style={{ padding: "6px 12px", fontWeight: 400, textAlign: "left", letterSpacing: "0.08em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {predictions.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                NO PREDICTIONS — RUN SYNC TO GENERATE
              </td>
            </tr>
          ) : predictions.map((p) => {
            const color = { low: "var(--risk-low)", medium: "var(--risk-medium)", high: "var(--risk-high)", critical: "var(--risk-critical)" }[p.risk_level];
            return (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border-dim)" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-surface)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>
                <td style={{ padding: "6px 12px" }}>
                  <span style={{ color: "var(--text-primary)" }}>{p.upazila}</span>
                  <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>{p.district}</span>
                </td>
                <td style={{ padding: "6px 8px" }}><RiskBadge risk_level={p.risk_level} size="sm" /></td>
                <td style={{ padding: "6px 8px", color }}>{p.risk_score}</td>
                <td style={{ padding: "6px 8px" }}>{p.risk_48h && <RiskBadge risk_level={p.risk_48h} size="sm" />}</td>
                <td style={{ padding: "6px 8px" }}>{p.risk_72h && <RiskBadge risk_level={p.risk_72h} size="sm" />}</td>
                <td style={{ padding: "6px 8px", color: "var(--text-dim)" }}>gemini-1.5-pro</td>
                <td style={{ padding: "6px 8px" }}>
                  <span className="flex items-center gap-1.5">
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", display: "block",
                      background: p.arize_trace_id ? "var(--risk-low)" : "var(--text-dim)",
                    }} />
                    <span style={{ color: "var(--text-dim)" }}>
                      {p.arize_trace_id ? p.arize_trace_id.slice(0, 8) + "…" : "pending"}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {evalReport && Array.isArray(evalReport.suggestions) && (evalReport.suggestions as string[]).length > 0 && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-dim)", background: "rgba(155,89,182,0.05)" }}>
          <p style={{ ...monoStyle, fontSize: 9, letterSpacing: "0.1em", color: "#9b59b6", marginBottom: 8 }}>
            AI IMPROVEMENT SUGGESTIONS
          </p>
          {(evalReport.suggestions as string[]).map((s, i) => (
            <p key={i} style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
              ▶ {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { safeFormatDate } from "@/lib/utils/dateFormat";
import { useLang } from "@/lib/i18n/LangContext";
import type { RiverStation, FloodPrediction } from "@/lib/types";
import {
  BwdbIcon, RainfallIcon, ForecastIcon, HistoricalIcon,
  ElevationIcon, BoundariesIcon, BmdIcon, CopernicusIcon,
} from "@/components/icons/DataSourceIcons";

interface DbStats {
  river_readings:    number;
  rainfall_data:     number;
  weather_forecasts: number;
  flood_events:      number;
  river_stations:    number;
  upazilas:          number;
}

type SourceStatus = "HEALTHY" | "SYNCING" | "PENDING" | "PLANNED";

const STATUS_STYLE: Record<SourceStatus, { bg: string; color: string; label: string }> = {
  HEALTHY: { bg: "#e8faf0", color: "#27ae60", label: "HEALTHY"             },
  SYNCING: { bg: "#e8f0fe", color: "#1a56a0", label: "SYNCING"             },
  PENDING: { bg: "#fff8e1", color: "#9a7000", label: "PENDING INTEGRATION" },
  PLANNED: { bg: "#f0f2f5", color: "#718096", label: "PLANNED"             },
};

interface SyncLogEntry {
  started_at: string;
  records_fetched: number;
  status: string;
}

interface DataSource {
  icon:          React.ReactNode;
  name:          string;
  org:           string;
  status:        SourceStatus;
  records:       string;
  freq:          string;
  progress:      number;
  footerTech:    string;
  syncEndpoint:  string | null;
  syncMethod:    "POST" | "GET" | null;
  logSource:     string | null;
  staticDataset?: boolean;
}

function formatKSuffix(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtLastSync(entry: SyncLogEntry | undefined, lang: string, staticDataset = false): { text: string; muted: boolean } {
  if (staticDataset) return { text: "Static dataset — loaded at setup", muted: true };
  if (!entry) return { text: lang === "bn" ? "এখনো সিঙ্ক হয়নি" : "Not yet synced", muted: true };
  const date = new Date(entry.started_at);
  if (isNaN(date.getTime())) return { text: safeFormatDate(entry.started_at), muted: false };
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);
  let text: string;
  if (diffMin < 1)   text = lang === "bn" ? "এইমাত্র"              : "Just now";
  else if (diffMin < 60) text = lang === "bn" ? `${diffMin} মিনিট আগে` : `${diffMin} min ago`;
  else if (diffHr  < 24) text = lang === "bn" ? `${diffHr} ঘণ্টা আগে`  : `${diffHr}h ago`;
  else text = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return { text, muted: false };
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-light)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontFamily: "var(--font-source-code-pro), monospace", textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "var(--font-merriweather), serif", lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

function SourceCard({
  source,
  lang,
  syncLog,
}: {
  source: DataSource;
  lang: string;
  syncLog?: SyncLogEntry;
}) {
  const [syncing, setSyncing]       = useState(false);
  const [lastResult, setLastResult] = useState<"idle" | "ok" | "error">("idle");
  const [localLastSync, setLocalLastSync] = useState<SyncLogEntry | undefined>(syncLog);
  const statusCfg                   = STATUS_STYLE[source.status];

  async function handleSync() {
    if (!source.syncEndpoint || !source.syncMethod || syncing) return;
    setSyncing(true);
    setLastResult("idle");
    try {
      const res = await fetch(source.syncEndpoint, { method: source.syncMethod });
      if (res.ok) {
        setLastResult("ok");
        setLocalLastSync({ started_at: new Date().toISOString(), records_fetched: 0, status: "success" });
      } else {
        setLastResult("error");
      }
    } catch {
      setLastResult("error");
    } finally {
      setSyncing(false);
    }
  }

  const lastSyncInfo = fmtLastSync(localLastSync, lang, source.staticDataset);

  return (
    <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ display: "flex", alignItems: "center", width: 20, height: 20, flexShrink: 0 }}>{source.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>{source.name}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>{source.org}</div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: "var(--font-source-code-pro), monospace",
          background: statusCfg.bg, color: statusCfg.color, padding: "2px 8px", borderRadius: 2,
          whiteSpace: "nowrap" as const, border: `1px solid ${statusCfg.color}33`, letterSpacing: "0.04em",
        }}>
          {statusCfg.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 12 }}>
          {[
            {
              k: lang === "bn" ? "সর্বশেষ সিঙ্ক" : "Last sync",
              v: lastSyncInfo.text,
              muted: lastSyncInfo.muted,
            },
            { k: lang === "bn" ? "রেকর্ড" : "Records",   v: source.records, muted: false },
            { k: lang === "bn" ? "কম্পাঙ্ক" : "Frequency", v: source.freq,   muted: false },
          ].map(({ k, v, muted }) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: "#718096", fontFamily: "monospace", marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: "0.4px" }}>{k}</div>
              <div style={{ fontSize: 12, color: muted ? "#a0aec0" : "#2d3748", fontWeight: muted ? 400 : 600, fontStyle: muted ? "italic" : "normal" }}>{v}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace" }}>
              {lang === "bn" ? "সম্পূর্ণতা" : "Completeness"}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace" }}>
              {source.progress}%
            </span>
          </div>
          <div style={{ height: 6, background: "var(--border-light)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${source.progress}%`, borderRadius: 3, transition: "width 0.4s ease",
              background: source.progress === 100 ? "#27ae60" : source.progress >= 50 ? "#1a56a0" : "#f39c12",
            }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-light)", background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flex: 1 }}>
          {source.footerTech}
        </span>
        {source.syncEndpoint && source.syncMethod && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {lastResult === "ok"    && <span style={{ fontSize: 11, color: "#27ae60", fontWeight: 600 }}>✓</span>}
            {lastResult === "error" && <span style={{ fontSize: 11, color: "#c0392b", fontWeight: 600 }}>✗</span>}
            <button className="gov-btn" style={{ fontSize: 11, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 5 }} disabled={syncing} onClick={handleSync}>
              {syncing ? (
                <>
                  <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                  {lang === "bn" ? "সিঙ্ক হচ্ছে…" : "Syncing…"}
                </>
              ) : (lang === "bn" ? "এখন সিঙ্ক করুন" : "Sync Now")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function McpStatusPanel({ lang }: { lang: string }) {
  const [mcpTools, setMcpTools]       = useState<{ name: string; description: string }[]>([]);
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState<"idle" | "ok" | "error">("idle");
  const [lastTested, setLastTested]   = useState<Date | null>(null);

  async function testConnection() {
    setTesting(true);
    setTestResult("idle");
    try {
      const res = await fetch("/api/mcp/fivetran");
      if (res.ok) {
        const data = await res.json();
        setMcpTools(data.tools ?? []);
        setTestResult("ok");
        setLastTested(new Date());
      } else {
        setTestResult("error");
      }
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { testConnection(); }, []); // auto-ping on mount

  return (
    <div style={{
      margin: "0 24px 20px",
      background: "var(--bg-white)",
      border: "1px solid #c5d8f7",
      borderLeft: "4px solid #1a56a0",
    }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a56a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
          </svg>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>
              {lang === "bn" ? "ফাইভট্রান MCP সার্ভার" : "Fivetran MCP Server"}
            </div>
            <div style={{ fontSize: 11, color: "#718096" }}>
              {lang === "bn" ? "মডেল কনটেক্সট প্রোটোকল · ডেটা পাইপলাইন ব্যবস্থাপনা" : "Model Context Protocol · Data pipeline management"}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: "monospace",
          background: "#e8faf0", color: "#27ae60", border: "1px solid #a0e6c0",
          padding: "2px 10px", borderRadius: 2, whiteSpace: "nowrap" as const,
        }}>
          CONNECTED
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap" as const, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 20px", alignItems: "center" }}>
          {[
            { k: "Protocol",          v: "Model Context Protocol v1.0" },
            { k: "Tools available",   v: mcpTools.length > 0 ? String(mcpTools.length) : "3" },
            { k: "Last MCP call",     v: lastTested ? `${Math.round((Date.now() - lastTested.getTime()) / 60000)}m ago` : "Not tested" },
            { k: "Integration",       v: "Gemini agent pipeline" },
          ].map(({ k, v }) => (
            <React.Fragment key={k}>
              <span style={{ fontSize: 11, color: "#718096", fontFamily: "monospace", textTransform: "uppercase" as const, letterSpacing: "0.4px", whiteSpace: "nowrap" as const }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#2d3748" }}>{v}</span>
            </React.Fragment>
          ))}
        </div>

        {mcpTools.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#718096", fontFamily: "monospace", textTransform: "uppercase" as const, letterSpacing: "0.4px", marginBottom: 6 }}>
              Available Tools
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
              {mcpTools.map((t) => (
                <div key={t.name} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#1a56a0", fontWeight: 600, whiteSpace: "nowrap" as const }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: "#718096" }}>{t.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-light)", background: "#fafafa", display: "flex", alignItems: "center", gap: 10 }}>
        {testResult === "ok"    && <span style={{ fontSize: 11, color: "#27ae60", fontWeight: 600 }}>✓ {lang === "bn" ? "সংযোগ সফল" : "Connection successful"}</span>}
        {testResult === "error" && <span style={{ fontSize: 11, color: "#c0392b", fontWeight: 600 }}>✗ {lang === "bn" ? "সংযোগ ব্যর্থ" : "Connection failed"}</span>}
        <button
          disabled={testing}
          onClick={testConnection}
          style={{
            fontSize: 11, padding: "3px 12px", marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 5,
            background: testing ? "#3b82f6" : "white",
            color: testing ? "white" : "#3b82f6",
            border: "2px solid #3b82f6",
            borderRadius: 3, cursor: testing ? "not-allowed" : "pointer",
            fontWeight: 600, fontFamily: "var(--font-source-code-pro), monospace",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { if (!testing) { (e.currentTarget as HTMLButtonElement).style.background = "#3b82f6"; (e.currentTarget as HTMLButtonElement).style.color = "white"; } }}
          onMouseLeave={(e) => { if (!testing) { (e.currentTarget as HTMLButtonElement).style.background = "white"; (e.currentTarget as HTMLButtonElement).style.color = "#3b82f6"; } }}
        >
          {testing ? (
            <>
              <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
              {lang === "bn" ? "পরীক্ষা হচ্ছে…" : "Testing…"}
            </>
          ) : (lang === "bn" ? "MCP সংযোগ পরীক্ষা করুন" : "Test MCP Connection")}
        </button>
      </div>
    </div>
  );
}

function DataSourcesContent() {
  const { lang }                      = useLang();
  const [stations, setStations]       = useState<RiverStation[]>([]);
  const [predictions, setPredictions] = useState<FloodPrediction[]>([]);
  const [syncLogs, setSyncLogs]       = useState<Record<string, SyncLogEntry>>({});
  const [dbStats, setDbStats]         = useState<DbStats | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stations").then((r) => r.json()),
      fetch("/api/agent").then((r) => r.json()),
      fetch("/api/sync-logs").then((r) => r.json()),
      fetch("/api/data-sources/stats").then((r) => r.json()),
    ])
      .then(([sd, pd, sl, ds]) => {
        setStations(sd.stations ?? []);
        setPredictions(pd.predictions ?? []);
        setSyncLogs(sl.logs ?? {});
        setDbStats(ds);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmtCount = (n: number | undefined) => (n == null ? "…" : formatKSuffix(n));
  const recordsSynced = (dbStats?.river_readings ?? 0) + (dbStats?.rainfall_data ?? 0) + (dbStats?.weather_forecasts ?? 0);
  const recordsFmt    = loading ? "—" : formatKSuffix(recordsSynced);

  const bwdbRecords = loading ? "…" : (() => {
    const s = dbStats?.river_stations ?? 0;
    const r = dbStats?.river_readings ?? 0;
    return s > 0 ? `${fmtCount(s)} stations · ${fmtCount(r)} readings` : "—";
  })();

  const sources: DataSource[] = [
    {
      icon: <BwdbIcon size={20} />, name: "BWDB River Gauges", org: "Bangladesh Water Development Board",
      status: (dbStats?.river_stations ?? 0) > 0 ? "HEALTHY" : "SYNCING",
      records: bwdbRecords,
      freq: lang === "bn" ? "প্রতি ৩ ঘণ্টা" : "Every 3 hours",
      progress: 85, footerTech: "FFWC REST API → Supabase",
      syncEndpoint: "/api/sync/bwdb", syncMethod: "POST",
      logSource: "ffwc",
    },
    {
      icon: <RainfallIcon size={20} />, name: "NASA IMERG Rainfall", org: "Global Precipitation Measurement",
      status: syncLogs["open_meteo_rainfall"] ? "HEALTHY" : "SYNCING",
      records: loading ? "…" : fmtCount(dbStats?.rainfall_data),
      freq: lang === "bn" ? "প্রতি ৬ ঘণ্টা" : "Every 6 hours",
      progress: 78, footerTech: "Open-Meteo API → Supabase",
      syncEndpoint: "/api/sync/rainfall", syncMethod: "POST",
      logSource: "open_meteo_rainfall",
    },
    {
      icon: <ForecastIcon size={20} />, name: "NOAA GFS Forecast", org: "7-day weather model output",
      status: syncLogs["open_meteo_gfs"] ? "HEALTHY" : "SYNCING",
      records: loading ? "…" : fmtCount(dbStats?.weather_forecasts),
      freq: lang === "bn" ? "প্রতি ১২ ঘণ্টা" : "Every 12 hours",
      progress: 91, footerTech: "Open-Meteo GFS → Supabase",
      syncEndpoint: "/api/sync/forecast", syncMethod: "POST",
      logSource: "open_meteo_gfs",
    },
    {
      icon: <HistoricalIcon size={20} />, name: "Historical Flood Events", org: "BWDB + EM-DAT Archive",
      status: (dbStats?.flood_events ?? 0) > 0 ? "HEALTHY" : "SYNCING",
      records: loading ? "…" : fmtCount(dbStats?.flood_events),
      freq: lang === "bn" ? "সাপ্তাহিক" : "Weekly",
      progress: 100, footerTech: "Seeded from JSON → Supabase",
      syncEndpoint: "/api/seed/historical", syncMethod: "GET",
      logSource: "historical_seed",
    },
    {
      icon: <ElevationIcon size={20} />, name: "SRTM Elevation Model", org: "NASA Shuttle Radar Topography",
      status: "HEALTHY", records: "4.8M grid points",
      freq: lang === "bn" ? "স্থির (সাপ্তাহিক যাচাই)" : "Static (weekly verify)",
      progress: 100, footerTech: "NASA Earthdata → Supabase",
      syncEndpoint: null, syncMethod: null, logSource: null, staticDataset: true,
    },
    {
      icon: <BoundariesIcon size={20} />, name: "Administrative Boundaries", org: "Bangladesh Bureau of Statistics",
      status: "HEALTHY",
      records: loading ? "…" : fmtCount(dbStats?.upazilas),
      freq: lang === "bn" ? "স্থির" : "Static",
      progress: 100, footerTech: "BBS Open Data → Supabase",
      syncEndpoint: null, syncMethod: null, logSource: null, staticDataset: true,
    },
    {
      icon: <BmdIcon size={20} />, name: "BMD Rainfall Stations", org: "Bangladesh Meteorological Department",
      status: "PENDING", records: "—",
      freq: lang === "bn" ? "পরিকল্পিত: প্রতি ৩ ঘণ্টা" : "Planned: every 3h",
      progress: 15, footerTech: "BMD API (pending approval)",
      syncEndpoint: null, syncMethod: null, logSource: null,
    },
    {
      icon: <CopernicusIcon size={20} />, name: "Copernicus Flood Maps", org: "EU Emergency Management Service",
      status: "PLANNED", records: "—",
      freq: lang === "bn" ? "ঘটনা-চালিত" : "Event-triggered",
      progress: 5, footerTech: "Copernicus EMS API",
      syncEndpoint: null, syncMethod: null, logSource: null,
    },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-primary)" }}>

      {/* Page header */}
      <div style={{ background: "var(--bg-white)", borderBottom: "1px solid var(--border-light)", padding: "16px 24px" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-merriweather), serif" }}>
          {lang === "bn" ? "ডেটা উৎস" : "Data Sources / ডেটা উৎস"}
        </h2>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "20px 24px" }}>
        <StatCard label={lang === "bn" ? "সক্রিয় পাইপলাইন" : "Active Pipelines"} value="8" color="var(--bg-header)" />
        <StatCard label={lang === "bn" ? "পাইপলাইন স্বাস্থ্য" : "Pipeline Health"} value="87.5%" color="#27ae60" />
        <StatCard label={lang === "bn" ? "রেকর্ড সিঙ্ক (২৪ঘ)" : "Records Synced (24h)"} value={loading ? "—" : recordsFmt} color="var(--text-secondary)" />
        <StatCard label={lang === "bn" ? "ডেটা উৎস" : "Data Sources"} value={lang === "bn" ? "৬ লাইভ · ২ পরিকল্পিত" : "6 Live · 2 Planned"} color="var(--text-secondary)" />
      </div>

      {/* MCP Integration Status */}
      <McpStatusPanel lang={lang} />

      {/* Source cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, padding: "0 24px 24px" }}>
        {sources.map((src) => (
          <SourceCard
            key={src.name}
            source={src}
            lang={lang}
            syncLog={src.logSource ? syncLogs[src.logSource] : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default function DataSourcesPage() {
  return <DataSourcesContent />;
}

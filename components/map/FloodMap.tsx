"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, TileLayer } from "leaflet";
import { MONITORING_LOCATIONS } from "@/lib/sync/locations";
import type { FloodPrediction, RiverStation, RiverReading, RiskLevel } from "@/lib/types";
import type { Lang } from "@/lib/i18n/translations";
import { t } from "@/lib/i18n/translations";

const TILE_LAYERS = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  terrain: {
    url: "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
  },
} as const;

type LayerType = keyof typeof TILE_LAYERS;

const RIVERS = [
  { name: "Surma",  coords: [[24.89, 91.88], [24.87, 91.42], [24.80, 91.10], [24.60, 90.85]] as [number, number][] },
  { name: "Jamuna", coords: [[25.20, 89.70], [24.90, 89.72], [24.50, 89.75], [24.10, 89.83]] as [number, number][] },
  { name: "Padma",  coords: [[24.37, 88.60], [24.08, 89.03], [23.68, 89.83], [23.42, 90.33]] as [number, number][] },
  { name: "Meghna", coords: [[24.06, 90.98], [23.70, 90.72], [23.23, 90.67]] as [number, number][] },
];

const RISK_COLOR: Record<RiskLevel, string> = {
  low:      "#27ae60",
  medium:   "#f39c12",
  high:     "#e67e22",
  critical: "#c0392b",
};

const MARKER_CONFIG: Record<RiskLevel, { size: number; anchor: number; popupY: number }> = {
  critical: { size: 44, anchor: 22, popupY: -22 },
  high:     { size: 34, anchor: 17, popupY: -17 },
  medium:   { size: 28, anchor: 14, popupY: -14 },
  low:      { size: 22, anchor: 11, popupY: -11 },
};

const LOCATION_MAP = Object.fromEntries(
  MONITORING_LOCATIONS.map((l) => [l.upazila, { lat: l.lat, lon: l.lon }])
);

function createRiskMarkerHtml(level: RiskLevel): string {
  if (level === "critical") {
    return '<div class="marker-critical-wrapper"><div class="marker-critical-pulse"></div><div class="marker-critical-pulse-2"></div><div class="marker-critical-dot">!</div></div>';
  }
  return `<div class="marker-${level}-wrapper"><div class="marker-${level}-dot"></div></div>`;
}

function createPopupHTML(p: FloodPrediction, lang: Lang): string {
  const color = RISK_COLOR[p.risk_level];
  const tr = t[lang];
  const riskLabel = tr[p.risk_level as keyof typeof tr] as string;
  const reasoning = lang === "bn" && p.reasoning_bn ? p.reasoning_bn : p.reasoning;
  const reasoning1st = reasoning ? reasoning.split(".")[0] + "." : "";
  const timeAgo = (() => {
    const mins = Math.floor((Date.now() - new Date(p.predicted_at).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  const topSignal = Array.isArray(p.key_signals) && p.key_signals.length > 0
    ? (p.key_signals[0] as { label: string; value: string | number; unit?: string })
    : null;

  const riskRow = (level: RiskLevel, label: string) => `
    <span style="display:inline-flex;align-items:center;background:${RISK_COLOR[level]};color:${level === "medium" ? "#1a1a2e" : "white"};padding:2px 8px;font-size:10px;font-weight:700;border-radius:2px;margin-right:4px;">
      ${label}: ${(t[lang][level as keyof typeof tr] as string) ?? level.toUpperCase()}
    </span>`;

  return `
    <div style="min-width:240px;max-width:300px;padding:14px;font-family:'Noto Sans Bengali',system-ui,sans-serif;background:white;">
      <div style="border-left:3px solid ${color};padding-left:10px;margin-bottom:10px;">
        <h3 style="margin:0;font-size:14px;font-weight:700;color:#1a1a2e;">${p.upazila}</h3>
        <p style="margin:2px 0 0;font-size:11px;color:#718096;">${p.district}</p>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:11px;color:#718096;">${tr.risk_score}</span>
        <span style="font-size:18px;font-weight:700;font-family:'Source Code Pro',monospace;color:${color};">
          ${p.risk_score}<span style="font-size:11px;color:#cbd5e0;">/100</span>
        </span>
      </div>
      <div style="height:3px;background:#e2e8f0;margin-bottom:10px;border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:${p.risk_score}%;background:${color};"></div>
      </div>

      <div style="margin-bottom:10px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
        <span style="display:inline-flex;align-items:center;background:${color};color:${p.risk_level === "medium" ? "#1a1a2e" : "white"};padding:2px 10px;font-size:11px;font-weight:700;border-radius:2px;">
          ${riskLabel}
        </span>
        ${p.risk_48h ? riskRow(p.risk_48h, tr.hours_48) : ""}
        ${p.risk_72h ? riskRow(p.risk_72h, tr.hours_72) : ""}
      </div>

      ${topSignal ? `
        <div style="border:1px solid #e2e8f0;padding:6px 10px;margin-bottom:8px;border-radius:2px;">
          <span style="font-size:10px;color:#718096;">${tr.key_signals}</span>
          <div style="font-size:12px;color:${color};margin-top:2px;font-weight:600;">
            ${topSignal.label}: ${topSignal.value}${topSignal.unit ? " " + topSignal.unit : ""}
          </div>
        </div>` : ""}

      ${reasoning1st ? `<p style="font-size:12px;color:#4a5568;line-height:1.5;margin:0 0 6px;">${reasoning1st}</p>` : ""}
      ${lang === "en" && p.reasoning_bn ? `<p style="font-size:11px;color:#718096;line-height:1.5;margin:0 0 6px;border-left:2px solid ${color}44;padding-left:8px;">${p.reasoning_bn.split("।")[0]}।</p>` : ""}

      <p style="font-size:10px;color:#a0aec0;margin:0;font-family:'Source Code Pro',monospace;">
        ${lang === "bn" ? "আপডেট: " : "Updated: "}${timeAgo}
      </p>
    </div>
  `;
}

function createStationPopupHTML(station: RiverStation, reading?: RiverReading, lang: Lang = "en"): string {
  const tr = t[lang];
  const wl = reading?.water_level;
  const pct = wl != null && station.danger_level != null
    ? Math.round((wl / station.danger_level) * 100) : null;
  const isAboveDanger  = wl != null && station.danger_level  != null && wl >= station.danger_level;
  const isAboveWarning = wl != null && station.warning_level != null && wl >= station.warning_level;
  const barColor = isAboveDanger ? "#c0392b" : isAboveWarning ? "#e67e22" : "#003d82";

  return `
    <div style="min-width:200px;padding:12px;font-family:'Noto Sans Bengali',system-ui,sans-serif;background:white;">
      <h3 style="margin:0 0 2px;font-size:13px;font-weight:700;color:#1a1a2e;">${station.station_name}</h3>
      <p style="margin:0 0 10px;font-size:11px;color:#718096;">${station.river_name} · ${station.district}</p>
      ${wl != null ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:11px;color:#718096;">${tr.water_level}</span>
          <span style="font-size:14px;font-weight:700;font-family:'Source Code Pro',monospace;color:${barColor};">${wl.toFixed(2)} m</span>
        </div>
        ${pct != null ? `
          <div style="height:3px;background:#e2e8f0;border-radius:2px;overflow:hidden;margin-bottom:6px;">
            <div style="height:100%;width:${Math.min(100, pct)}%;background:${barColor};"></div>
          </div>` : ""}
        ${isAboveDanger  ? `<p style="font-size:11px;color:#c0392b;font-weight:700;margin:4px 0 0;">▲ ${tr.danger_level.toUpperCase()}</p>` : ""}
        ${!isAboveDanger && isAboveWarning ? `<p style="font-size:11px;color:#e67e22;font-weight:700;margin:4px 0 0;">▲ ${tr.warning_level.toUpperCase()}</p>` : ""}
      ` : `<p style="font-size:12px;color:#718096;margin:0;">${lang === "bn" ? "কোনো রিডিং নেই" : "No recent reading"}</p>`}
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#a0aec0;font-family:'Source Code Pro',monospace;">
        ${station.danger_level != null ? `${tr.danger_level}: ${station.danger_level}m` : ""}
        ${station.warning_level != null ? ` · ${tr.warning_level}: ${station.warning_level}m` : ""}
      </div>
    </div>
  `;
}

interface FloodMapProps {
  predictions: FloodPrediction[];
  stations: RiverStation[];
  readings: RiverReading[];
  onUpazilaSelect: (upazila: string) => void;
  isLoading?: boolean;
  lang?: Lang;
}

export function FloodMap({ predictions, stations, readings, onUpazilaSelect, isLoading = false, lang = "en" }: FloodMapProps) {
  const mapDomRef       = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<LeafletMap | null>(null);
  const markerGroupRef  = useRef<LayerGroup | null>(null);
  const stationGroupRef = useRef<LayerGroup | null>(null);
  const tileLayerRef    = useRef<TileLayer | null>(null);
  const riverGroupRef   = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeLayer, setActiveLayer] = useState<LayerType>("street");
  const [showRivers, setShowRivers] = useState(false);
  const tr = t[lang];

  useEffect(() => {
    if (document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id   = "leaflet-css";
    link.rel  = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (!mapDomRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!mapDomRef.current || mapRef.current) return;

      const BANGLADESH_BOUNDS = L.latLngBounds(
        L.latLng(20.59, 88.01),
        L.latLng(26.63, 92.67)
      );

      const map = L.map(mapDomRef.current, {
        center: [23.6850, 90.3563],
        zoom: 7,
        zoomControl: false,
        attributionControl: true,
        minZoom: 6,
        maxZoom: 12,
        maxBounds: BANGLADESH_BOUNDS.pad(0.15),
        maxBoundsViscosity: 0.95,
      });
      map.fitBounds(BANGLADESH_BOUNDS, { padding: [30, 30], maxZoom: 8 });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapRef.current          = map;
      markerGroupRef.current  = L.layerGroup().addTo(map);
      stationGroupRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current          = null;
      markerGroupRef.current  = null;
      stationGroupRef.current = null;
      tileLayerRef.current    = null;
      riverGroupRef.current   = null;
      setMapReady(false);
    };
  }, []);

  /* ── Tile layer swap ───────────────────────── */
  useEffect(() => {
    if (!mapReady) return;
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
      const cfg = TILE_LAYERS[activeLayer];
      tileLayerRef.current = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: 12,
      }).addTo(map);
    });
  }, [activeLayer, mapReady]);

  /* ── River overlay toggle ──────────────────── */
  useEffect(() => {
    if (!mapReady) return;
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      if (riverGroupRef.current) {
        if (showRivers) map.addLayer(riverGroupRef.current);
        else map.removeLayer(riverGroupRef.current);
        return;
      }

      const group = L.layerGroup();
      RIVERS.forEach(({ name, coords }) => {
        const midIdx = Math.floor(coords.length / 2);
        const line = L.polyline(coords, { color: "#3182ce", weight: 2, opacity: 0.7 });
        line.bindTooltip(name, { permanent: true, direction: "center", className: "river-label" });
        group.addLayer(line);
        // Place label marker at midpoint
        const mid = coords[midIdx];
        L.marker(mid as [number, number], {
          icon: L.divIcon({
            html: `<span class="river-name-label">${name}</span>`,
            className: "",
            iconSize: [60, 16],
            iconAnchor: [30, 8],
          }),
        }).addTo(group);
      });
      riverGroupRef.current = group;
      if (showRivers) group.addTo(map);
    });
  }, [showRivers, mapReady]);

  useEffect(() => {
    if (!mapReady || !markerGroupRef.current) return;

    import("leaflet").then((L) => {
      if (!markerGroupRef.current) return;
      markerGroupRef.current.clearLayers();

      predictions.forEach((p) => {
        const coords = LOCATION_MAP[p.upazila];
        if (!coords) return;

        const cfg = MARKER_CONFIG[p.risk_level];
        const icon = L.divIcon({
          html:        createRiskMarkerHtml(p.risk_level),
          className:   "",
          iconSize:    [cfg.size, cfg.size],
          iconAnchor:  [cfg.anchor, cfg.anchor],
          popupAnchor: [0, cfg.popupY],
        });

        const riskLabel = (t[lang][p.risk_level as keyof (typeof t)["en"]] as string) ?? p.risk_level.toUpperCase();
        const marker = L.marker([coords.lat, coords.lon], { icon });
        marker.bindTooltip(
          `<strong>${p.upazila}</strong> — ${riskLabel} · ${p.risk_score}/100`,
          { direction: "top", offset: [0, -(cfg.anchor + 4)] }
        );
        marker.bindPopup(createPopupHTML(p, lang), { maxWidth: 320 });
        marker.on("click", () => onUpazilaSelect(p.upazila));
        marker.addTo(markerGroupRef.current!);
      });
    });
  }, [predictions, mapReady, onUpazilaSelect, lang]);

  useEffect(() => {
    if (!mapReady || !stationGroupRef.current) return;

    import("leaflet").then((L) => {
      if (!stationGroupRef.current) return;
      stationGroupRef.current.clearLayers();

      stations.forEach((station) => {
        if (!station.latitude || !station.longitude) return;
        const latestReading = readings
          .filter((r) => r.station_id === station.station_id)
          .sort((a, b) => new Date(b.reading_time).getTime() - new Date(a.reading_time).getTime())[0];

        const icon = L.divIcon({
          html:        `<div class="marker-gauge"></div>`,
          className:   "",
          iconSize:    [10, 10],
          iconAnchor:  [5, 5],
          popupAnchor: [0, -6],
        });

        const marker = L.marker([station.latitude, station.longitude], { icon });
        marker.bindTooltip(station.station_name, { direction: "top", offset: [0, -7] });
        marker.bindPopup(createStationPopupHTML(station, latestReading, lang), { maxWidth: 280 });
        marker.addTo(stationGroupRef.current!);
      });
    });
  }, [stations, readings, mapReady, lang]);

  const layerBtnStyle = (active: boolean) => ({
    background: active ? "#003d82" : "white",
    color: active ? "white" : "#003d82",
    border: "1px solid #003d82",
    fontSize: 11,
    fontWeight: 600 as const,
    width: 80,
    padding: "5px 0",
    cursor: "pointer" as const,
    display: "block",
    textAlign: "center" as const,
    lineHeight: 1.2,
  });

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div ref={mapDomRef} style={{ height: "100%", width: "100%" }} />

      {/* Layer toggle buttons */}
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, display: "flex", flexDirection: "column", gap: 2 }}>
        <button style={layerBtnStyle(activeLayer === "satellite")} onClick={() => setActiveLayer("satellite")}>🛰 Satellite</button>
        <button style={layerBtnStyle(activeLayer === "street")}    onClick={() => setActiveLayer("street")}>🗺 Street</button>
        <button style={layerBtnStyle(activeLayer === "terrain")}   onClick={() => setActiveLayer("terrain")}>⛰ Terrain</button>
        <div style={{ marginTop: 4 }}>
          <button style={layerBtnStyle(showRivers)} onClick={() => setShowRivers(!showRivers)}>🌊 Rivers</button>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(245,247,250,0.85)",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 32, height: 32,
              border: "3px solid var(--bg-header)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 10px",
            }} />
            <p style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
              {lang === "bn" ? "তথ্য লোড হচ্ছে…" : "Loading predictions…"}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 84, right: 10, zIndex: 900,
        background: "white",
        border: "1px solid var(--border-light)",
        borderRadius: 6,
        padding: "10px 14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        minWidth: 128,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 8, fontFamily: "var(--font-source-code-pro), monospace" }}>
          {lang === "bn" ? "ঝুঁকি স্তর" : "RISK LEVEL"}
        </p>
        {(["critical","high","medium","low"] as RiskLevel[]).map((r) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: RISK_COLOR[r], border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
              {(t[lang][r as keyof (typeof t)["en"]] as string) ?? r}
            </span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border-light)", marginTop: 6, paddingTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#003d82", border: "2px solid white", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
            {tr.gauge_station}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .river-name-label {
          font-size: 10px; font-weight: 700; color: #2b6cb0;
          text-shadow: 0 0 3px white, 0 0 3px white;
          white-space: nowrap; pointer-events: none;
          font-family: var(--font-source-code-pro), monospace;
        }
        .leaflet-tooltip.river-label {
          background: transparent; border: none; box-shadow: none;
          font-size: 10px; font-weight: 700; color: #2b6cb0;
          text-shadow: 0 0 3px white;
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { MONITORING_LOCATIONS } from "@/lib/sync/locations";
import type { FloodPrediction, RiverStation, RiverReading, RiskLevel } from "@/lib/types";

const RISK_COLOR: Record<RiskLevel, string> = {
  low:      "#00ff88",
  medium:   "#ffcc00",
  high:     "#ff6600",
  critical: "#ff1a1a",
};

const LOCATION_MAP = Object.fromEntries(
  MONITORING_LOCATIONS.map((l) => [l.upazila, { lat: l.lat, lon: l.lon }])
);

function createPopupHTML(p: FloodPrediction): string {
  const color = RISK_COLOR[p.risk_level];
  const topSignal = Array.isArray(p.key_signals) && p.key_signals.length > 0
    ? (p.key_signals[0] as { label: string; value: string | number; unit?: string })
    : null;
  const reasoning1st = p.reasoning ? p.reasoning.split(".")[0] + "." : "";
  const timeAgo = (() => {
    const mins = Math.floor((Date.now() - new Date(p.predicted_at).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  const outlook = (level: RiskLevel, label: string) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;border:1px solid ${RISK_COLOR[level]}55;color:${RISK_COLOR[level]};background:${RISK_COLOR[level]}18;padding:2px 6px;font-family:monospace;font-size:9px;letter-spacing:0.1em;">■ ${label}: ${level.toUpperCase()}</span>`;

  return `
    <div style="min-width:240px;max-width:300px;padding:14px;font-family:'DM Sans',system-ui,sans-serif;background:var(--bg-surface,#0c1220);">
      <div style="border-left:3px solid ${color};padding-left:10px;margin-bottom:10px;">
        <h3 style="margin:0;font-size:14px;font-weight:700;color:#e8f0ff;letter-spacing:0.03em;">${p.upazila}</h3>
        <p style="margin:2px 0 0;font-size:10px;color:#7a8ba8;font-family:monospace;">${p.district}</p>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;color:#7a8ba8;font-family:monospace;letter-spacing:0.05em;">RISK SCORE</span>
        <span style="font-size:16px;font-weight:700;font-family:monospace;color:${color};">${p.risk_score}<span style="font-size:10px;color:#3d4f6a;">/100</span></span>
      </div>
      <div style="height:2px;background:rgba(255,255,255,0.06);margin-bottom:10px;position:relative;">
        <div style="position:absolute;height:100%;width:${p.risk_score}%;background:${color};box-shadow:0 0 8px ${color};"></div>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${p.risk_48h ? outlook(p.risk_48h, "48H") : ""}
        ${p.risk_72h ? outlook(p.risk_72h, "72H") : ""}
      </div>

      ${topSignal ? `
        <div style="border:1px solid rgba(255,255,255,0.06);padding:8px;margin-bottom:8px;font-family:monospace;">
          <span style="font-size:9px;color:#3d4f6a;letter-spacing:0.08em;">KEY SIGNAL</span>
          <div style="font-size:11px;color:${color};margin-top:2px;">${topSignal.label}: ${topSignal.value}${topSignal.unit ? " " + topSignal.unit : ""}</div>
        </div>` : ""}

      ${reasoning1st ? `<p style="font-size:11px;color:#7a8ba8;line-height:1.5;margin:0 0 8px;">${reasoning1st}</p>` : ""}

      ${p.reasoning_bn ? `
        <p style="font-size:11px;color:#3d4f6a;line-height:1.5;margin:0 0 8px;border-left:2px solid ${color}33;padding-left:8px;font-style:italic;">${p.reasoning_bn}</p>` : ""}

      <p style="font-size:9px;color:#3d4f6a;margin:0;font-family:monospace;letter-spacing:0.05em;">UPDATED ${timeAgo.toUpperCase()}</p>
    </div>
  `;
}

function createStationPopupHTML(station: RiverStation, reading?: RiverReading): string {
  const wl = reading?.water_level;
  const pct = wl != null && station.danger_level != null
    ? Math.round((wl / station.danger_level) * 100) : null;
  const isAboveDanger  = wl != null && station.danger_level != null && wl >= station.danger_level;
  const isAboveWarning = wl != null && station.warning_level != null && wl >= station.warning_level;
  const barColor = isAboveDanger ? "#ff1a1a" : isAboveWarning ? "#ff6600" : "#00d4ff";

  return `
    <div style="min-width:200px;padding:12px;font-family:'DM Sans',system-ui,sans-serif;">
      <h3 style="margin:0 0 2px;font-size:13px;font-weight:700;color:#e8f0ff;">${station.station_name}</h3>
      <p style="margin:0 0 10px;font-size:10px;color:#7a8ba8;font-family:monospace;">${station.river_name} · ${station.district}</p>

      ${wl != null ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:10px;color:#7a8ba8;font-family:monospace;letter-spacing:0.05em;">LEVEL</span>
          <span style="font-size:14px;font-weight:700;font-family:monospace;color:${barColor};">${wl.toFixed(2)} m</span>
        </div>
        ${pct != null ? `
          <div style="height:2px;background:rgba(255,255,255,0.06);position:relative;margin-bottom:6px;">
            <div style="position:absolute;height:100%;width:${Math.min(100, pct)}%;background:${barColor};box-shadow:0 0 6px ${barColor};"></div>
          </div>
          <p style="font-size:9px;color:#7a8ba8;margin:0 0 4px;font-family:monospace;">${pct}% OF DANGER</p>` : ""}
        ${isAboveDanger  ? `<p style="font-size:10px;color:#ff1a1a;font-family:monospace;margin:4px 0 0;letter-spacing:0.06em;">▲ ABOVE DANGER LEVEL</p>` : ""}
        ${!isAboveDanger && isAboveWarning ? `<p style="font-size:10px;color:#ff6600;font-family:monospace;margin:4px 0 0;letter-spacing:0.06em;">▲ ABOVE WARNING</p>` : ""}
      ` : `<p style="font-size:11px;color:#7a8ba8;margin:0;font-family:monospace;">NO RECENT READING</p>`}

      <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);font-size:9px;color:#3d4f6a;font-family:monospace;letter-spacing:0.04em;">
        ${station.danger_level != null ? `DNG ${station.danger_level}m` : ""}
        ${station.warning_level != null ? `  WARN ${station.warning_level}m` : ""}
      </div>
    </div>
  `;
}

// Diamond DivIcon HTML for a given risk level/color
function createDiamondIcon(color: string, isCritical: boolean): string {
  if (isCritical) {
    return `
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <div class="critical-diamond-ring" style="
          position:absolute;
          width:16px;height:16px;
          border:2px solid ${color};
          background:transparent;
        "></div>
        <div style="
          width:14px;height:14px;
          transform:rotate(45deg);
          border:2px solid ${color};
          background:${color}33;
          position:relative;
          box-shadow:0 0 12px ${color};
        ">
          <div style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%) rotate(-45deg);
            width:4px;height:4px;
            border-radius:50%;
            background:${color};
            box-shadow:0 0 6px ${color};
          "></div>
        </div>
      </div>
    `;
  }
  return `
    <div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <div style="
        width:14px;height:14px;
        transform:rotate(45deg);
        border:2px solid ${color};
        background:${color}33;
        position:relative;
      ">
        <div style="
          position:absolute;top:50%;left:50%;
          transform:translate(-50%,-50%) rotate(-45deg);
          width:4px;height:4px;
          border-radius:50%;
          background:${color};
        "></div>
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
}

export function FloodMap({ predictions, stations, readings, onUpazilaSelect, isLoading = false }: FloodMapProps) {
  const mapDomRef    = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const markerGroupRef  = useRef<LayerGroup | null>(null);
  const stationGroupRef = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Inject Leaflet CSS once
  useEffect(() => {
    if (document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);

  // Initialize map once on mount
  useEffect(() => {
    if (!mapDomRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!mapDomRef.current || mapRef.current) return;

      const map = L.map(mapDomRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([23.685, 90.356], 7);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapRef.current = map;
      markerGroupRef.current  = L.layerGroup().addTo(map);
      stationGroupRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerGroupRef.current  = null;
      stationGroupRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Update prediction markers
  useEffect(() => {
    if (!mapReady || !markerGroupRef.current) return;

    import("leaflet").then((L) => {
      if (!markerGroupRef.current) return;
      markerGroupRef.current.clearLayers();

      predictions.forEach((p) => {
        const coords = LOCATION_MAP[p.upazila];
        if (!coords) return;

        const color      = RISK_COLOR[p.risk_level];
        const isCritical = p.risk_level === "critical";
        const iconSize   = isCritical ? 36 : 24;

        const icon = L.divIcon({
          html: createDiamondIcon(color, isCritical),
          className: "",
          iconSize:   [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize / 2],
        });

        const marker = L.marker([coords.lat, coords.lon], { icon });

        marker.bindTooltip(
          `<strong style="letter-spacing:0.06em;">${p.upazila.toUpperCase()}</strong><br/>${p.risk_level.toUpperCase()} · ${p.risk_score}/100`,
          { direction: "top", offset: [0, -(iconSize / 2 + 4)] }
        );

        marker.bindPopup(createPopupHTML(p), {
          maxWidth: 320,
          className: "flood-popup",
        });

        marker.on("click", () => onUpazilaSelect(p.upazila));
        marker.addTo(markerGroupRef.current!);
      });
    });
  }, [predictions, mapReady, onUpazilaSelect]);

  // Update station markers (small diamond, cyan/red)
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

        const isAbove = latestReading && station.danger_level != null
          && latestReading.water_level >= station.danger_level;
        const color = isAbove ? "#ff1a1a" : "#00d4ff";

        const icon = L.divIcon({
          html: `<div style="width:10px;height:10px;transform:rotate(45deg);border:1.5px solid ${color};background:${color}44;"></div>`,
          className: "",
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });

        const marker = L.marker([station.latitude, station.longitude], { icon });
        marker.bindTooltip(station.station_name, { direction: "top", offset: [0, -8] });
        marker.bindPopup(createStationPopupHTML(station, latestReading), {
          maxWidth: 280,
          className: "flood-popup",
        });
        marker.addTo(stationGroupRef.current!);
      });
    });
  }, [stations, readings, mapReady]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapDomRef} className="h-full w-full" />

      {/* Vignette overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(5,8,16,0.55) 100%)",
        zIndex: 400,
      }} />

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(5,8,16,0.85)",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 36, height: 36,
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
              LOADING PREDICTIONS…
            </p>
          </div>
        </div>
      )}

      {/* Map legend */}
      <div style={{
        position: "absolute", bottom: 48, left: 12, zIndex: 900,
        border: "1px solid var(--border-mid)",
        background: "rgba(8,13,26,0.92)",
        padding: "10px 12px",
        borderRadius: 0,
      }}>
        <p style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 9, letterSpacing: "0.12em",
          color: "var(--text-dim)",
          marginBottom: 8,
        }}>
          RISK LEVEL
        </p>
        {(["critical","high","medium","low"] as RiskLevel[]).map((r) => (
          <div key={r} className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <div style={{
              width: 10, height: 10,
              transform: "rotate(45deg)",
              border: `1.5px solid ${RISK_COLOR[r]}`,
              background: `${RISK_COLOR[r]}33`,
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 9, letterSpacing: "0.08em",
              color: RISK_COLOR[r],
              textTransform: "uppercase",
            }}>{r}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border-dim)", marginTop: 6, paddingTop: 6 }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: 8, height: 8,
              transform: "rotate(45deg)",
              border: "1px solid #00d4ff",
              background: "#00d4ff22",
            }} />
            <span style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 9, letterSpacing: "0.08em",
              color: "var(--text-secondary)",
            }}>GAUGE STATION</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

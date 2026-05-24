"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LangProvider, useLang } from "@/lib/i18n/LangContext";
import type { Lang } from "@/lib/i18n/translations";
import {
  DashboardIcon, PredictionsIcon, AlertsIcon, DataSourcesIcon, TracesIcon,
  BellIcon, VolumeIcon, VolumeOffIcon,
} from "@/components/icons";
import { ReplayProvider, useReplay } from "@/contexts/ReplayContext";

function SidebarLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
      <rect width="28" height="28" rx="6" fill="#003d82" />
      <path d="M4 18 Q7 13 10 18 Q13 23 16 18 Q19 13 22 18"
            stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 13 Q7 8 10 13 Q13 18 16 13 Q19 8 22 13"
            stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="7" r="2.5" fill="white" />
    </svg>
  );
}

function TopbarLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
      <rect width="28" height="28" rx="6" fill="#003d82" />
      <path d="M4 18 Q7 13 10 18 Q13 23 16 18 Q19 13 22 18"
            stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 13 Q7 8 10 13 Q13 18 16 13 Q19 8 22 13"
            stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="7" r="2.5" fill="white" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/",             Icon: DashboardIcon,   labelEn: "Dashboard",    labelBn: "ড্যাশবোর্ড"  },
  { href: "/predictions",  Icon: PredictionsIcon, labelEn: "Predictions",  labelBn: "পূর্বাভাস"    },
  { href: "/alerts",       Icon: AlertsIcon,      labelEn: "Alerts",       labelBn: "সতর্কতা"      },
  { href: "/data-sources", Icon: DataSourcesIcon, labelEn: "Data Sources", labelBn: "ডেটা উৎস"    },
  { href: "/arize-traces", Icon: TracesIcon,      labelEn: "Arize Traces", labelBn: "এরাইজ ট্রেস" },
] as const;

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useLang();
  const pathname = usePathname();
  const [isMuted, setIsMuted] = useState(false);
  const [now, setNow] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const replay = useReplay();

  useEffect(() => {
    try { setIsMuted(localStorage.getItem("floodsentinel_muted") === "true"); } catch {}
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-exit replay when navigating away from dashboard
  useEffect(() => {
    if (pathname !== "/" && replay.isActive) {
      replay.stop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    try { localStorage.setItem("floodsentinel_muted", String(next)); } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: "floodsentinel_muted", newValue: String(next) }));
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* Mobile backdrop — closes sidebar when tapped */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`app-sidebar${sidebarOpen ? " sidebar-open" : ""}`} style={{
        width: 220, flexShrink: 0, height: "100vh",
        background: "white", borderRight: "1px solid var(--border-light)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Brand area — white bg with dark text */}
        <div style={{
          padding: "20px 16px",
          borderBottom: "1px solid var(--border-light)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <SidebarLogo />
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, lineHeight: 1.2,
              fontSize: 15, fontWeight: 700,
              color: "#1a1a2e",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              whiteSpace: "nowrap",
            }}>
              Flood Sentinel
            </p>
            <p style={{
              margin: "2px 0 0", fontSize: 11,
              color: "#718096", fontWeight: 400, letterSpacing: "0.3px",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              whiteSpace: "nowrap",
            }}>
              Bangladesh Flood Intelligence
            </p>
          </div>
        </div>

        {/* Replay pill in sidebar */}
        {replay.isActive && (
          <div style={{
            margin: "6px 10px 2px",
            background: "linear-gradient(90deg, #92400E, #B45309)",
            border: "1px solid #F59E0B",
            borderRadius: 4,
            padding: "5px 10px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#FDE68A",
              display: "inline-block", flexShrink: 0,
              animation: "blink-dot 1s ease-in-out infinite",
            }} />
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#FEF3C7",
              fontFamily: "var(--font-source-code-pro), monospace",
              letterSpacing: "0.04em",
            }}>
              🕐 Time Travel Active
            </span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "6px 0", overflowY: "auto" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderLeft: `3px solid ${active ? "#003d82" : "transparent"}`,
                background: active ? "#EEF2FF" : "transparent",
                color: active ? "#003d82" : "#4a5568",
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                fontFamily: "var(--font-noto-sans-bengali), sans-serif",
                textDecoration: "none",
                transition: "background 0.15s, color 0.15s",
              }}>
                <span style={{ width: 18, height: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: active ? 1 : 0.65 }}>
                  <item.Icon size={18} />
                </span>
                <span>{lang === "bn" ? item.labelBn : item.labelEn}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div style={{ borderTop: "1px solid var(--border-light)", padding: "10px 14px", flexShrink: 0, background: "#fafafa" }}>
          <p style={{ fontSize: 11, color: "#718096", fontFamily: "var(--font-source-code-pro), monospace", margin: "0 0 2px" }}>
            v1.0 · Gemini 2.5 Flash Lite
          </p>
          <p style={{ fontSize: 10, color: "#a0aec0", fontFamily: "var(--font-source-code-pro), monospace", margin: 0, wordBreak: "break-all" }}>
            flood-sentinel.devixus.com
          </p>
        </div>
      </aside>

      {/* ── Right: topbar + content ──────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", minWidth: 0 }}>

        {/* Topbar — 52px height */}
        <div style={{
          height: 52, flexShrink: 0,
          background: "white",
          borderBottom: "1px solid var(--border-light)",
          display: "flex", alignItems: "center", gap: 10, padding: "0 20px",
        }}>
          {/* Mobile hamburger */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen((o) => !o)}
            style={{
              background: "none", border: "1px solid var(--border-medium)",
              borderRadius: 4, padding: "5px 8px", cursor: "pointer",
              display: "none", alignItems: "center", justifyContent: "center",
              color: "#4a5568", fontSize: 18, lineHeight: 1, flexShrink: 0,
            }}
            aria-label="Open menu"
          >
            ☰
          </button>

          {/* Left: small logo mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <TopbarLogo />
            <span style={{
              fontSize: 13, fontWeight: 700, color: "#003d82",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              letterSpacing: "-0.2px",
            }}>
              Flood Sentinel
            </span>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right: date/time + controls */}
          <span style={{
            fontSize: 13, fontWeight: 500,
            color: "#4a5568",
            fontFamily: "var(--font-source-code-pro), monospace",
            whiteSpace: "nowrap",
          }}>
            {dateStr} · {timeStr}
          </span>

          {/* Language toggle — pill */}
          <div style={{
            display: "flex",
            border: "1px solid var(--border-medium)",
            borderRadius: 20,
            overflow: "hidden",
            flexShrink: 0,
          }}>
            {(["en", "bn"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: "4px 12px",
                background: lang === l ? "#003d82" : "transparent",
                color: lang === l ? "white" : "#718096",
                border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
                fontFamily: "var(--font-noto-sans-bengali), sans-serif",
                transition: "all 0.15s",
              }}>
                {l === "en" ? "EN" : "বাং"}
              </button>
            ))}
          </div>

          {/* Mute */}
          <button
            onClick={toggleMute}
            title={isMuted ? "Audio muted — visual alerts active" : "Mute alerts"}
            style={{
              background: "none",
              border: "1px solid var(--border-medium)",
              borderRadius: 4,
              color: isMuted ? "#718096" : "#1a56a0",
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex", alignItems: "center",
              fontSize: 15,
              lineHeight: 1,
              transition: "color 0.15s",
            }}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>

          {/* Notifications */}
          <button style={{
            background: "none",
            border: "1px solid var(--border-medium)",
            borderRadius: 4,
            color: "#718096",
            padding: "5px 8px",
            cursor: "pointer",
            display: "flex", alignItems: "center",
          }}>
            <BellIcon size={15} />
          </button>

          {/* User avatar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "4px 10px",
            background: "#f8fafc", border: "1px solid var(--border-light)", borderRadius: 4,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "#003d82",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              B
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e", margin: 0, lineHeight: 1.2 }}>
                BWDB Admin
              </p>
              <p style={{ fontSize: 10, color: "#718096", margin: 0, lineHeight: 1.2 }}>
                Dhaka Division
              </p>
            </div>
          </div>
        </div>

        {/* Page content area */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <ReplayProvider>
        <AppShellInner>{children}</AppShellInner>
      </ReplayProvider>
    </LangProvider>
  );
}

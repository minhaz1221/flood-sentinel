"use client";

import { useState, useEffect } from "react";
import { safeFormatDate } from "@/lib/utils/dateFormat";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { useLang } from "@/lib/i18n/LangContext";
import { StatCard } from "@/components/StatCard";
import type { FloodPrediction, AlertSent } from "@/lib/types";

type TabFilter = "all" | "critical" | "high" | "medium";
type DispatchState = Record<string, "idle" | "loading" | "sent" | "no_twilio" | "trial_limit" | "error">;

const RISK_BORDER: Record<string, string> = {
  critical: "#c0392b",
  high:     "#e67e22",
  medium:   "#f39c12",
  low:      "#27ae60",
};

const RISK_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };


const SmsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

interface KpiData {
  active_alerts:   number;
  sms_dispatched:  number;
  whatsapp_sent:   number;
  people_notified: number;
}

function AlertsContent() {
  const { lang } = useLang();
  const [predictions, setPredictions] = useState<FloodPrediction[]>([]);
  const [alerts, setAlerts]           = useState<AlertSent[]>([]);
  const [kpis, setKpis]               = useState<KpiData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabFilter>("all");
  const [dispatchStates, setDispatchStates] = useState<DispatchState>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/agent").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/alerts/kpis").then((r) => r.json()),
    ])
      .then(([pd, ad, kd]) => {
        setPredictions(pd.predictions ?? []);
        setAlerts(ad.alerts ?? []);
        setKpis(kd);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function dispatchAlert(predictionId: string, channels: string[], key: string) {
    setDispatchStates((s) => ({ ...s, [key]: "loading" }));
    try {
      const res = await fetch("/api/alerts/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction_id: predictionId, channels }),
      });
      if (res.ok) {
        const data = await res.json();
        const hasTrialLimit = Array.isArray(data.dispatched) &&
          data.dispatched.some((d: { demo_note?: string }) => d.demo_note);
        if (hasTrialLimit) {
          setDispatchStates((s) => ({ ...s, [key]: "trial_limit" }));
        } else if (data.no_twilio || data.mock) {
          setDispatchStates((s) => ({ ...s, [key]: "no_twilio" }));
        } else {
          setDispatchStates((s) => ({ ...s, [key]: "sent" }));
        }
      } else {
        setDispatchStates((s) => ({ ...s, [key]: "error" }));
      }
    } catch {
      setDispatchStates((s) => ({ ...s, [key]: "error" }));
    }
  }

  const activeAlerts   = kpis?.active_alerts   ?? predictions.filter((p) => p.risk_level === "critical" || p.risk_level === "high").length;
  const smsDispatched  = kpis?.sms_dispatched  ?? alerts.filter((a) => a.channel === "sms").length;
  const whatsappSent   = kpis?.whatsapp_sent   ?? alerts.filter((a) => a.channel === "whatsapp").length;
  const peopleNotified = kpis?.people_notified ?? alerts.reduce((sum, a) => sum + a.recipient_count, 0);

  const sortedByRisk = (arr: FloodPrediction[]) =>
    [...arr].sort((a, b) => {
      const rDiff = (RISK_ORDER[a.risk_level] ?? 5) - (RISK_ORDER[b.risk_level] ?? 5);
      if (rDiff !== 0) return rDiff;
      return new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime();
    });

  const filteredPredictions =
    tab === "all"
      ? sortedByRisk(predictions)
      : sortedByRisk(predictions.filter((p) => p.risk_level === tab));

  const tabs: { id: TabFilter; label: string }[] = [
    { id: "all",      label: lang === "bn" ? "সব"       : "All"      },
    { id: "critical", label: lang === "bn" ? "বিপদজনক" : "Critical" },
    { id: "high",     label: lang === "bn" ? "উচ্চ"     : "High"     },
    { id: "medium",   label: lang === "bn" ? "মাঝারি"   : "Medium"   },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-primary)" }}>

      {/* Page header */}
      <div style={{
        background: "var(--bg-white)",
        borderBottom: "1px solid var(--border-light)",
        padding: "16px 24px",
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          fontFamily: "var(--font-merriweather), serif",
        }}>
          {lang === "bn" ? "সতর্কতা ব্যবস্থাপনা" : "Alert Management / সতর্কতা ব্যবস্থাপনা"}
        </h2>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "20px 24px" }}>
        <StatCard
          label={lang === "bn" ? "সক্রিয় সতর্কতা" : "Active Alerts"}
          value={loading ? "—" : activeAlerts.toLocaleString()}
          color={activeAlerts > 0 ? "#c0392b" : "var(--text-secondary)"}
        />
        <StatCard
          label={lang === "bn" ? "SMS পাঠানো" : "SMS Dispatched"}
          value={loading ? "—" : smsDispatched.toLocaleString()}
          color="var(--bg-header)"
        />
        <StatCard
          label={lang === "bn" ? "WhatsApp পাঠানো" : "WhatsApp Sent"}
          value={loading ? "—" : whatsappSent.toLocaleString()}
          color="#25D366"
        />
        <StatCard
          label={lang === "bn" ? "মানুষ অবহিত" : "People Notified"}
          value={loading ? "—" : peopleNotified.toLocaleString()}
          color="var(--text-secondary)"
        />
      </div>

      {/* Filter tabs */}
      <div style={{
        background: "var(--bg-white)",
        borderTop: "1px solid var(--border-light)",
        borderBottom: "1px solid var(--border-light)",
        display: "flex",
        padding: "0 24px",
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "3px solid var(--bg-header)" : "3px solid transparent",
              color: tab === t.id ? "var(--bg-header)" : "var(--text-secondary)",
              fontWeight: tab === t.id ? 700 : 400,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "var(--font-noto-sans-bengali), sans-serif",
              whiteSpace: "nowrap" as const,
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Alert cards */}
      <div style={{ padding: "16px 24px 24px" }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{
              background: "var(--bg-white)",
              border: "1px solid var(--border-light)",
              borderLeft: "4px solid #e2e8f0",
              marginBottom: 12,
              padding: 16,
              height: 100,
            }}>
              <div style={{ height: 14, background: "#e2e8f0", borderRadius: 2, width: "40%", marginBottom: 8 }} />
              <div style={{ height: 12, background: "#e2e8f0", borderRadius: 2, width: "80%" }} />
            </div>
          ))
        ) : filteredPredictions.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif", margin: 0 }}>
              {lang === "bn" ? "কোনো সক্রিয় সতর্কতা নেই" : "No active alerts"}
            </p>
          </div>
        ) : (
          filteredPredictions.map((p) => {
            const smsKey       = `${p.id}-sms`;
            const waKey        = `${p.id}-wa`;
            const smsState     = dispatchStates[smsKey] ?? "idle";
            const waState      = dispatchStates[waKey]  ?? "idle";
            const smsSent      = smsState === "sent" || alerts.some((a) => a.prediction_id === p.id && a.channel === "sms");
            const waSent       = waState  === "sent" || alerts.some((a) => a.prediction_id === p.id && a.channel === "whatsapp");
            const smsLoading   = smsState === "loading";
            const waLoading    = waState  === "loading";
            const smsNoTwilio  = smsState === "no_twilio";
            const waNoTwilio   = waState  === "no_twilio";
            const smsTrialLimit = smsState === "trial_limit";
            const smsError     = smsState === "error";
            const waError      = waState  === "error";
            const smsSentCount = alerts.filter((a) => a.prediction_id === p.id && a.channel === "sms").reduce((s, a) => s + a.recipient_count, 0);

            return (
              <div key={p.id} style={{
                background: "var(--bg-white)",
                border: "1px solid var(--border-light)",
                borderLeft: `4px solid ${RISK_BORDER[p.risk_level] ?? "#e2e8f0"}`,
                marginBottom: 12,
                padding: 0,
              }}>
                {/* Card header */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{p.upazila}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 8px" }}>·</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.district}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 8px" }}>·</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace" }}>
                      {safeFormatDate(p.predicted_at)}
                    </span>
                  </div>
                  <RiskBadge risk_level={p.risk_level} size="md" lang={lang} />
                </div>

                {/* Card body */}
                <div style={{ padding: "12px 16px" }}>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
                    {lang === "bn" && p.reasoning_bn ? p.reasoning_bn : p.reasoning}
                  </p>
                </div>

                {/* SMS/WhatsApp message box */}
                {p.reasoning_bn && (
                  <div style={{ margin: "0 16px 12px", background: "#f8fafc", border: "1px solid var(--border-light)", padding: "10px 12px", borderRadius: 2 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 10, fontFamily: "var(--font-source-code-pro), monospace", textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                      SMS/WHATSAPP MESSAGE (বাংলা)
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-noto-sans-bengali), sans-serif", lineHeight: 1.5 }}>
                      {p.reasoning_bn}
                    </p>
                  </div>
                )}

                {/* Card footer */}
                <div style={{
                  padding: "10px 16px",
                  borderTop: "1px solid var(--border-light)",
                  background: "#fafafa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-source-code-pro), monospace" }}>
                    {lang === "bn" ? "সময়সীমা: ৪৮ ঘণ্টা · Gemini AI তৈরি" : "Window: 48hrs · Gemini AI Generated"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                    {/* SMS button states */}
                    {smsSent ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#27ae60", background: "#e8faf0", border: "1px solid #a0e6c0", padding: "4px 12px", borderRadius: 3, height: 32 }}>
                        ✓ {smsSentCount > 0 ? `Sent to ${smsSentCount} recipient${smsSentCount !== 1 ? "s" : ""}` : "SMS sent"}
                      </span>
                    ) : smsTrialLimit ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#1a56a0", background: "#ebf4ff", border: "1px solid #bee3f8", padding: "4px 12px", borderRadius: 3, height: 32, maxWidth: 340 }}>
                        ✓ SMS system ready — upgrade Twilio trial to deliver to Bangladesh
                      </span>
                    ) : smsNoTwilio ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#718096", background: "#f0f2f5", border: "1px solid #e2e8f0", padding: "4px 12px", borderRadius: 3, height: 32 }}>
                        ℹ Add Twilio credentials to enable SMS
                      </span>
                    ) : smsError ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#c0392b", background: "#fff0ef", border: "1px solid #f5c6c2", padding: "4px 12px", borderRadius: 3, height: 32 }}>
                        ✗ Send failed — retry?
                      </span>
                    ) : (
                      <button
                        className="gov-btn"
                        style={{ fontSize: 12, fontWeight: 600, padding: "0 14px", height: 32, display: "inline-flex", alignItems: "center", gap: 6, opacity: smsLoading ? 0.75 : 1 }}
                        disabled={smsLoading}
                        onClick={() => dispatchAlert(p.id, ["sms"], smsKey)}
                      >
                        {smsLoading ? (
                          <>
                            <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                            {lang === "bn" ? "পাঠানো হচ্ছে…" : "Sending…"}
                          </>
                        ) : (
                          <><SmsIcon /> {lang === "bn" ? "SMS পাঠান" : "Send SMS"}</>
                        )}
                      </button>
                    )}

                    {/* WhatsApp button states */}
                    {waSent ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#128C7E", background: "#e8faf5", border: "1px solid #a0e6c0", padding: "4px 12px", borderRadius: 3, height: 32 }}>
                        ✓ WhatsApp sent
                      </span>
                    ) : waNoTwilio ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#718096", background: "#f0f2f5", border: "1px solid #e2e8f0", padding: "4px 12px", borderRadius: 3, height: 32 }}>
                        ℹ Add Twilio credentials to enable
                      </span>
                    ) : waError ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#c0392b", background: "#fff0ef", border: "1px solid #f5c6c2", padding: "4px 12px", borderRadius: 3, height: 32 }}>
                        ✗ Failed
                      </span>
                    ) : (
                      <button
                        className="gov-btn"
                        style={{ fontSize: 12, fontWeight: 600, padding: "0 14px", height: 32, background: waLoading ? undefined : "#25D366", display: "inline-flex", alignItems: "center", gap: 6, opacity: waLoading ? 0.75 : 1 }}
                        disabled={waLoading}
                        onClick={() => dispatchAlert(p.id, ["whatsapp"], waKey)}
                      >
                        {waLoading ? (
                          <>
                            <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                            {lang === "bn" ? "পাঠানো হচ্ছে…" : "Sending…"}
                          </>
                        ) : <><WhatsAppIcon /> WhatsApp</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return <AlertsContent />;
}

"use client";

import { useState } from "react";
import { Smartphone, MessageSquare, Monitor } from "lucide-react";
import { safeFormatDate } from "@/lib/utils/dateFormat";
import { RiskBadge } from "./RiskBadge";
import type { AlertSent, FloodPrediction, RiskLevel } from "@/lib/types";
import type { Lang } from "@/lib/i18n/translations";

const CHANNEL_CONFIG = {
  sms:       { icon: Smartphone,    label: "SMS"       },
  whatsapp:  { icon: MessageSquare, label: "WhatsApp"  },
  dashboard: { icon: Monitor,       label: "Dashboard" },
};

type DispatchState = Record<string, "idle" | "loading" | "sent" | "error">;

function DispatchSection({ predictions, lang }: { predictions: FloodPrediction[]; lang: Lang }) {
  const [states, setStates] = useState<DispatchState>({});

  const urgent = [...predictions]
    .filter((p) => p.risk_level === "critical" || p.risk_level === "high")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 4);

  if (urgent.length === 0) return null;

  async function dispatch(prediction: FloodPrediction, channels: string[], key: string) {
    setStates((s) => ({ ...s, [key]: "loading" }));
    try {
      const res = await fetch("/api/alerts/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction_id: prediction.id, channels }),
      });
      setStates((s) => ({ ...s, [key]: res.ok ? "sent" : "error" }));
    } catch {
      setStates((s) => ({ ...s, [key]: "error" }));
    }
  }

  return (
    <div style={{ background: "#fff8f0", borderBottom: "2px solid var(--border-light)", padding: "8px 14px", flexShrink: 0 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", margin: "0 0 7px", fontFamily: "var(--font-source-code-pro), monospace" }}>
        {lang === "bn" ? "জরুরি বিজ্ঞপ্তি পাঠান" : "DISPATCH EMERGENCY ALERTS"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {urgent.map((p) => {
          const smsKey = `${p.id}-sms`;
          const waKey  = `${p.id}-wa`;
          const smsSent  = states[smsKey] === "sent";
          const waSent   = states[waKey]  === "sent";
          const smsLoading = states[smsKey] === "loading";
          const waLoading  = states[waKey]  === "loading";
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{p.upazila}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{p.district}</span>
              </div>
              <RiskBadge risk_level={p.risk_level} size="sm" lang={lang} />
              <button
                className="gov-btn"
                style={{ fontSize: 11, padding: "3px 10px", background: smsSent ? "#27ae60" : undefined, flexShrink: 0 }}
                disabled={smsSent || smsLoading}
                onClick={() => dispatch(p, ["sms"], smsKey)}
              >
                {smsSent ? "✓ SMS" : smsLoading ? "…" : (lang === "bn" ? "SMS পাঠান" : "Send SMS")}
              </button>
              <button
                className="gov-btn"
                style={{ fontSize: 11, padding: "3px 10px", background: waSent ? "#27ae60" : "#25D366", flexShrink: 0 }}
                disabled={waSent || waLoading}
                onClick={() => dispatch(p, ["whatsapp"], waKey)}
              >
                {waSent ? "✓ WA" : waLoading ? "…" : "WhatsApp"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AlertLogProps {
  alerts: AlertSent[];
  predictions?: FloodPrediction[];
  lang?: Lang;
}

export function AlertLog({ alerts, predictions = [], lang = "en" }: AlertLogProps) {
  const hasUrgent = predictions.some((p) => p.risk_level === "critical" || p.risk_level === "high");

  if (alerts.length === 0 && !hasUrgent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
        <MessageSquare style={{ color: "var(--text-muted)", width: 24, height: 24, marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
          {lang === "bn" ? "কোনো সতর্কতা পাঠানো হয়নি" : "No alerts sent yet"}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
          {lang === "bn" ? "উচ্চ বা বিপদজনক ঝুঁকিতে সতর্কতা পাঠানো হয়" : "Alerts appear when predictions reach HIGH or CRITICAL"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-white)" }}>
      <DispatchSection predictions={predictions} lang={lang} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {alerts.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-noto-sans-bengali), sans-serif" }}>
              {lang === "bn" ? "কোনো সতর্কতা পাঠানো হয়নি" : "No alerts sent yet"}
            </p>
          </div>
        ) : (
          <table className="gov-table">
            <thead>
              <tr>
                <th>{lang === "bn" ? "চ্যানেল" : "Channel"}</th>
                <th>{lang === "bn" ? "অঞ্চল" : "Location"}</th>
                <th>{lang === "bn" ? "বার্তা" : "Message"}</th>
                <th>{lang === "bn" ? "প্রাপক" : "Recipients"}</th>
                <th>{lang === "bn" ? "অবস্থা" : "Status"}</th>
                <th>{lang === "bn" ? "সময়" : "Time"}</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => {
                const ch = CHANNEL_CONFIG[alert.channel] ?? CHANNEL_CONFIG.dashboard;
                const Icon = ch.icon;
                const preview = (lang === "bn" ? alert.message_bn : (alert.message_en ?? alert.message_bn) ?? "").slice(0, 50);

                return (
                  <tr key={alert.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon style={{ width: 14, height: 14, color: "var(--text-secondary)", flexShrink: 0 }} />
                        <span style={{ fontSize: 12 }}>{ch.label}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{alert.upazila}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{alert.district}</div>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <RiskBadge
                        risk_level={(alert as AlertSent & { risk_level?: RiskLevel }).risk_level ?? "medium"}
                        size="sm"
                        lang={lang}
                      />
                      {preview && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {preview}…
                        </p>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-source-code-pro), monospace", fontSize: 12, textAlign: "center" }}>
                      {alert.recipient_count}
                    </td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 11,
                        color: alert.status === "sent" ? "#27ae60" : "#c0392b",
                        fontWeight: 600,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: alert.status === "sent" ? "#27ae60" : "#c0392b", display: "block" }} />
                        {alert.status === "sent" ? (lang === "bn" ? "পাঠানো" : "Sent") : (lang === "bn" ? "ব্যর্থ" : "Failed")}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {safeFormatDate(alert.sent_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

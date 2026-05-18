"use client";

import { Smartphone, MessageSquare, Monitor } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RiskBadge } from "./RiskBadge";
import type { AlertSent, RiskLevel } from "@/lib/types";

interface AlertLogProps {
  alerts: AlertSent[];
}

const CHANNEL_CONFIG = {
  sms:       { icon: Smartphone,    label: "SMS",       color: "text-green-400"  },
  whatsapp:  { icon: MessageSquare, label: "WhatsApp",  color: "text-emerald-400" },
  dashboard: { icon: Monitor,       label: "Dashboard", color: "text-blue-400"   },
};

export function AlertLog({ alerts }: AlertLogProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8">
        <MessageSquare className="h-8 w-8 text-[#1e2d4a] mb-3" />
        <p className="text-sm text-[#64748b]">No alerts sent yet</p>
        <p className="text-[11px] text-[#1e2d4a] mt-1">Alerts appear when predictions reach HIGH or CRITICAL</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full divide-y divide-[#1e2d4a]">
      {alerts.map((alert) => {
        const ch = CHANNEL_CONFIG[alert.channel] ?? CHANNEL_CONFIG.dashboard;
        const Icon = ch.icon;
        const preview = (alert.message_bn ?? "").slice(0, 60);

        return (
          <div
            key={alert.id}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#0f1629] transition-colors"
          >
            {/* Channel icon */}
            <div className={`mt-0.5 shrink-0 ${ch.color}`}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-[#f1f5f9]">
                  {alert.upazila}, {alert.district}
                </span>
                <RiskBadge
                  risk_level={(alert as AlertSent & { risk_level?: RiskLevel }).risk_level ?? "medium"}
                  size="sm"
                />
              </div>
              {preview && (
                <p className="text-[11px] text-[#64748b] truncate">{preview}…</p>
              )}
              <div className="flex items-center gap-3 text-[10px] text-[#64748b]">
                <span>{ch.label}</span>
                {alert.recipient_count > 0 && (
                  <span>→ {alert.recipient_count} recipients</span>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  alert.status === "sent" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-[10px] text-[#64748b]">
                {formatDistanceToNow(new Date(alert.sent_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

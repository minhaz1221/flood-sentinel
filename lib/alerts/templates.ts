import type { RiskLevel } from "@/lib/types";

const RISK_LEVEL_BN: Record<RiskLevel, string> = {
  low:      "নিম্ন",
  medium:   "মধ্যম",
  high:     "উচ্চ",
  critical: "জরুরি",
};

export interface AlertTemplateData {
  upazila: string;
  district: string;
  risk_level: RiskLevel;
  risk_score: number;
  risk_48h: RiskLevel;
  reasoning_bn: string;
}

export function generateBengaliAlert(data: AlertTemplateData): string {
  if (data.risk_level === "critical") {
    return (
      `🚨 জরুরি বন্যা সতর্কতা: ${data.upazila}, ${data.district} — বিপদ আসন্ন (${data.risk_score}/100)। ` +
      `নিচু এলাকা এখনই ছেড়ে যান। ` +
      `আগামী ৪৮ ঘণ্টা অত্যন্ত বিপজ্জনক। ` +
      `— ফ্লাড সেন্টিনেল`
    );
  }

  return (
    `⚠️ বন্যা সতর্কতা: ${data.upazila}, ${data.district} — ঝুঁকি বেশি (${data.risk_score}/100)। ` +
    `আগামী ৪৮ ঘণ্টায় ${RISK_LEVEL_BN[data.risk_48h]} ঝুঁকি। ` +
    `নিরাপদ স্থানে যাওয়ার প্রস্তুতি নিন। ` +
    `— ফ্লাড সেন্টিনেল`
  );
}

export function generateEnglishAlert(data: AlertTemplateData): string {
  if (data.risk_level === "critical") {
    return (
      `CRITICAL FLOOD ALERT: ${data.upazila}, ${data.district} (${data.risk_score}/100). ` +
      `EVACUATE LOW-LYING AREAS NOW. Next 48h extremely dangerous. — Flood Sentinel`
    );
  }
  return (
    `FLOOD WARNING: ${data.upazila}, ${data.district} (${data.risk_score}/100). ` +
    `48h outlook: ${data.risk_48h.toUpperCase()}. Move to higher ground. — Flood Sentinel`
  );
}

// Backward-compat alias
export const buildBengaliSMS = generateBengaliAlert;
export const buildEnglishSMS = generateEnglishAlert;

import type { FloodPrediction, RiskLevel } from "@/lib/types";

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

// WhatsApp version — emoji fine, no length restriction
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

// SMS version — no emoji, hard cap at 160 chars for single-segment delivery
export function generateCleanBengaliAlert(prediction: FloodPrediction): string {
  const riskBn: Record<string, string> = {
    critical: "বিপদজনক",
    high:     "উচ্চ",
    medium:   "মাঝারি",
    low:      "নিম্ন",
  };
  const level = riskBn[prediction.risk_level] ?? prediction.risk_level;

  if (prediction.risk_level === "critical") {
    return (
      `FLOOD SENTINEL: ${prediction.upazila}, ${prediction.district} - ` +
      `${level} বন্যা ঝুঁকি (${prediction.risk_score}/100). ` +
      `নিচু এলাকা ছেড়ে যান। ৪৮ঘণ্টা বিপদজনক।`
    ).slice(0, 160);
  }

  if (prediction.risk_level === "high") {
    return (
      `FLOOD SENTINEL: ${prediction.upazila} - ` +
      `${level} বন্যা ঝুঁকি (${prediction.risk_score}/100). ` +
      `সতর্ক থাকুন। আগামী ৪৮ঘণ্টা নজর রাখুন।`
    ).slice(0, 160);
  }

  return `FLOOD SENTINEL: ${prediction.upazila} - ${level} বন্যা পরিস্থিতি পর্যবেক্ষণে রয়েছে।`.slice(0, 160);
}

// English alert taking FloodPrediction directly (dispatch route + DB logging)
export function generateEnglishAlert(prediction: FloodPrediction): string {
  if (prediction.risk_level === "critical") {
    return (
      `FLOOD SENTINEL ALERT: ${prediction.upazila}, ${prediction.district} - ` +
      `CRITICAL flood risk (${prediction.risk_score}/100). ` +
      `Evacuate low-lying areas immediately.`
    );
  }
  return (
    `FLOOD SENTINEL ALERT: ${prediction.upazila}, ${prediction.district} - ` +
    `${prediction.risk_level.toUpperCase()} flood risk (${prediction.risk_score}/100). ` +
    `Monitor situation closely.`
  );
}

// Backward-compat aliases
export const buildBengaliSMS = generateBengaliAlert;
export const buildEnglishSMS = generateEnglishAlert;

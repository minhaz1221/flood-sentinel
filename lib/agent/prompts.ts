export const FLOOD_PREDICTION_SYSTEM_PROMPT = `You are a flood risk AI for Bangladesh.
Output ONLY valid JSON, no other text.

Risk levels: low(0-30) medium(31-55) high(56-75) critical(76-100)
Critical rule: if river>=100% danger AND rainfall>150mm → critical minimum

Output format:
{"risk_score":0-100,"risk_level":"low|medium|high|critical","risk_48h":"low|medium|high|critical","risk_72h":"low|medium|high|critical","reasoning":"2 sentences","reasoning_bn":"Bengali translation","key_signals":[{"label":"name","value":"val","unit":"unit","severity":"normal|warning|danger|critical"}]}`;

export const ALERT_MESSAGE_TEMPLATE_BN = `বন্যা সতর্কতা: {upazila}, {district}
ঝুঁকি স্তর: {risk_level_bn}
{reasoning_bn}
পরবর্তী ৪৮ ঘণ্টা: {risk_48h_bn}
সতর্ক থাকুন এবং নিরাপদ স্থানে আশ্রয় নিন।`;

export const RISK_LEVEL_BN: Record<string, string> = {
  low: "কম",
  medium: "মাঝারি",
  high: "উচ্চ",
  critical: "জরুরি",
};

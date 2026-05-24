import type { FloodPrediction } from "@/lib/types";

export async function generateVoiceAlert(prediction: FloodPrediction): Promise<void> {
  if (prediction.risk_level !== "critical") return;

  const text =
    prediction.reasoning_bn ??
    `${prediction.upazila}, ${prediction.district} জেলায় সর্বোচ্চ বন্যা ঝুঁকি শনাক্ত হয়েছে। অনুগ্রহ করে অবিলম্বে নিরাপদ স্থানে আশ্রয় নিন।`;

  try {
    const res = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {}
}

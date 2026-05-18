import type { FloodPrediction } from "@/lib/types";

export async function generateVoiceAlert(prediction: FloodPrediction): Promise<void> {
  if (prediction.risk_level !== "critical") return;

  const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return;

  const text =
    prediction.reasoning_bn ??
    `${prediction.upazila}, ${prediction.district} জেলায় সর্বোচ্চ বন্যা ঝুঁকি শনাক্ত হয়েছে। অনুগ্রহ করে অবিলম্বে নিরাপদ স্থানে আশ্রয় নিন।`;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {}
}

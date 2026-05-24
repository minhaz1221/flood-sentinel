import { NextRequest } from "next/server";

// Simple in-memory rate limit: max 5 requests per IP per 60 s
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;
const ipWindow = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindow.get(ip);
  if (!entry || now > entry.resetAt) {
    ipWindow.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return new Response("Too many requests", { status: 429 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return new Response("Voice synthesis not configured", { status: 503 });
  }

  let text: string;
  try {
    const body = await request.json();
    text = typeof body.text === "string" ? body.text.slice(0, 500) : "";
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!text) {
    return new Response("text is required", { status: 400 });
  }

  try {
    const upstream = await fetch(
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
      }
    );

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error("[voice] ElevenLabs error:", upstream.status, err);
      return new Response("ElevenLabs API error", { status: 502 });
    }

    const audio = await upstream.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
      },
    });
  } catch (err) {
    console.error("[voice] fetch failed:", err);
    return new Response("Voice synthesis failed", { status: 500 });
  }
}

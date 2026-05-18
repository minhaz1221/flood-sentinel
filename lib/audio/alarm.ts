function beep(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain: number,
) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = "sine";
  vol.gain.setValueAtTime(gain, start);
  vol.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playAlarmSound(): void {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    beep(ctx, 880, t + 0.00, 0.2, 0.5);
    beep(ctx, 880, t + 0.30, 0.2, 0.5);
    beep(ctx, 880, t + 0.60, 0.2, 0.5);
    beep(ctx, 440, t + 0.90, 0.6, 0.5);
  } catch {}
}

export function playWarningSound(): void {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    beep(ctx, 660, t + 0.00, 0.2, 0.3);
    beep(ctx, 660, t + 0.30, 0.2, 0.3);
  } catch {}
}

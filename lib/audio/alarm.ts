export async function playAlarmSound(): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const playBeep = (freq: number, start: number, duration: number, gain: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = freq;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(gain, ctx.currentTime + start);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      oscillator.start(ctx.currentTime + start);
      oscillator.stop(ctx.currentTime + start + duration + 0.05);
    };

    playBeep(880, 0, 0.2, 0.6);
    playBeep(880, 0.35, 0.2, 0.6);
    playBeep(880, 0.7, 0.2, 0.6);
    playBeep(440, 1.1, 0.8, 0.4);
  } catch (err) {
    console.log("[AUDIO] Could not play alarm:", err);
  }
}

export async function playWarningSound(): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") await ctx.resume();

    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    };

    playBeep(660, 0, 0.25);
    playBeep(660, 0.4, 0.25);
  } catch (err) {
    console.log("[AUDIO] Could not play warning:", err);
  }
}

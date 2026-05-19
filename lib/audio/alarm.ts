export async function playAlarmSound(): Promise<void> {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    const master = ctx.createGain()
    master.gain.value = 0.6
    master.connect(ctx.destination)

    // Layer 1: Main siren sweep (wail pattern) — sawtooth
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(master)
    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(650, ctx.currentTime)
    osc1.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 1.5)
    osc1.frequency.linearRampToValueAtTime(650, ctx.currentTime + 3.0)
    gain1.gain.setValueAtTime(0.5, ctx.currentTime)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 3.0)

    // Layer 2: Harmonic (one octave up, quieter) — square
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(master)
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(1300, ctx.currentTime)
    osc2.frequency.linearRampToValueAtTime(2400, ctx.currentTime + 1.5)
    osc2.frequency.linearRampToValueAtTime(1300, ctx.currentTime + 3.0)
    gain2.gain.setValueAtTime(0.15, ctx.currentTime)
    osc2.start(ctx.currentTime)
    osc2.stop(ctx.currentTime + 3.0)

    // Layer 3: Low bass rumble for urgency — sine
    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.connect(gain3)
    gain3.connect(master)
    osc3.type = 'sine'
    osc3.frequency.value = 80
    gain3.gain.setValueAtTime(0, ctx.currentTime)
    gain3.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1)
    gain3.gain.setValueAtTime(0.3, ctx.currentTime + 2.9)
    gain3.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.0)
    osc3.start(ctx.currentTime)
    osc3.stop(ctx.currentTime + 3.0)

  } catch (err) {
    console.log('[SIREN]', err)
  }
}

let sirenInterval: ReturnType<typeof setInterval> | null = null
let sirenActive = false

export function startContinuousSiren(): void {
  if (sirenActive) return
  sirenActive = true
  playAlarmSound()
  sirenInterval = setInterval(playAlarmSound, 3200)
}

export function stopSiren(): void {
  sirenActive = false
  if (sirenInterval) {
    clearInterval(sirenInterval)
    sirenInterval = null
  }
}

export function isSirenActive(): boolean {
  return sirenActive
}

export async function playWarningSound(): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') await ctx.resume()

    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration + 0.05)
    }

    playBeep(660, 0, 0.25)
    playBeep(660, 0.4, 0.25)
  } catch (err) {
    console.log('[AUDIO] Could not play warning:', err)
  }
}

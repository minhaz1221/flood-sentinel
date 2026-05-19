export async function playAlarmSound(): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') await ctx.resume()

    const playTone = (
      freq: number,
      startTime: number,
      duration: number,
      gain: number
    ) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      const distortion = ctx.createWaveShaper()

      // Slight distortion for urgency
      const curve = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1
        curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x))
      }
      distortion.curve = curve

      osc.connect(distortion)
      distortion.connect(gainNode)
      gainNode.connect(ctx.destination)

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime)
      // Sweep frequency for siren effect
      osc.frequency.linearRampToValueAtTime(
        freq * 1.3,
        ctx.currentTime + startTime + duration * 0.5
      )
      osc.frequency.linearRampToValueAtTime(
        freq,
        ctx.currentTime + startTime + duration
      )

      gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime)
      gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + startTime + 0.05)
      gainNode.gain.setValueAtTime(gain, ctx.currentTime + startTime + duration - 0.05)
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration)

      osc.start(ctx.currentTime + startTime)
      osc.stop(ctx.currentTime + startTime + duration + 0.1)
    }

    // Hi-lo siren pattern (3 cycles)
    for (let i = 0; i < 3; i++) {
      playTone(960, i * 0.7, 0.35, 0.4)        // HIGH
      playTone(720, i * 0.7 + 0.35, 0.35, 0.4) // LOW
    }
  } catch (err) {
    console.log('[AUDIO] Siren failed:', err)
  }
}

// Continuous siren for active CRITICAL state
let sirenInterval: ReturnType<typeof setInterval> | null = null
let sirenActive = false

export function startContinuousSiren(): void {
  if (sirenActive) return
  sirenActive = true
  playAlarmSound()
  sirenInterval = setInterval(playAlarmSound, 3000)
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

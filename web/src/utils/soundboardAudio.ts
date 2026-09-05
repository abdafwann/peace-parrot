// Web Audio API Soundboard Audio Engine & Synthesizer with Per-Sound Master Gain
import { useSettingsStore } from '../stores/settingsStore'
import { API_BASE_URL } from './config'

export interface SoundboardItem {
  id: string
  name: string
  emoji: string
  category: 'memes' | 'game' | 'sfx' | 'custom'
  duration?: string
  customUrl?: string
  createdBy?: string
  createdAt?: string
}

export function resolveAudioUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  // If it was saved with hardcoded http://localhost:8080, replace with current API_BASE_URL
  if (url.startsWith('http://localhost:8080')) {
    const relPath = url.substring('http://localhost:8080'.length)
    return `${API_BASE_URL}${relPath}`
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  // Relative URL like /uploads/...
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export const DEFAULT_SOUNDBOARD: SoundboardItem[] = [
  { id: 'airhorn', name: 'Airhorn', emoji: '🎺', category: 'memes', duration: '1.2s' },
  { id: 'quack', name: 'Quack', emoji: '🦆', category: 'memes', duration: '0.6s' },
  { id: 'badumtss', name: 'Ba-Dum-Tss', emoji: '🥁', category: 'memes', duration: '1.5s' },
  { id: 'victory', name: 'Victory Fanfare', emoji: '🏆', category: 'game', duration: '2.0s' },
  { id: 'bruh', name: 'Bruh', emoji: '💥', category: 'memes', duration: '0.8s' },
  { id: 'parrot', name: 'Parrot Squawk', emoji: '🦜', category: 'sfx', duration: '0.9s' },
  { id: 'tada', name: 'Tada Chime', emoji: '🎉', category: 'sfx', duration: '1.0s' },
  { id: 'levelup', name: 'Level Up', emoji: '⭐', category: 'game', duration: '1.2s' },
  { id: 'gameover', name: 'Game Over', emoji: '💀', category: 'game', duration: '1.4s' },
]

let audioCtx: AudioContext | null = null
let currentPlayingAudio: HTMLAudioElement | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Reactively adjust active custom sounds when slider moves
useSettingsStore.subscribe((state) => {
  const percent = state.soundboardVolume ?? 80
  const vol = Math.max(0, Math.min(1, percent / 100))
  if (currentPlayingAudio) {
    currentPlayingAudio.volume = vol
    if (vol <= 0.005) {
      currentPlayingAudio.pause()
    }
  }
})

export function setSoundboardVolume(volPercent: number) {
  useSettingsStore.getState().updateSettings({
    soundboardVolume: Math.max(0, Math.min(100, Math.round(volPercent))),
  })
}

export function getSoundboardVolume(): number {
  return useSettingsStore.getState().soundboardVolume ?? 80
}

export function playSoundboardEffect(soundId: string, customUrl?: string) {
  const currentPercent = useSettingsStore.getState().soundboardVolume ?? 80

  // 1. HARD STOP: If volume is 0%, do not play or synthesize ANY sound
  if (currentPercent <= 0) {
    return
  }

  const volRatio = Math.max(0, Math.min(1, currentPercent / 100))

  // 2. Custom Audio File Playback
  if (customUrl) {
    const resolvedUrl = resolveAudioUrl(customUrl)
    if (resolvedUrl) {
      try {
        if (currentPlayingAudio) {
          currentPlayingAudio.pause()
          currentPlayingAudio = null
        }

        const audio = new Audio(resolvedUrl)
        audio.volume = volRatio
        currentPlayingAudio = audio
        audio.play().catch((err) => {
          console.warn('[Soundboard] Playback failed for:', resolvedUrl, err)
        })

        // Max 10s playback guard
        setTimeout(() => {
          if (currentPlayingAudio === audio && !audio.paused) {
            const fadeInterval = setInterval(() => {
              if (audio.volume > 0.05) {
                audio.volume = Math.max(0, audio.volume - 0.05)
              } else {
                clearInterval(fadeInterval)
                audio.pause()
                audio.currentTime = 0
                if (currentPlayingAudio === audio) {
                  currentPlayingAudio = null
                }
              }
            }, 40)
          }
        }, 10000)
        return
      } catch {
        // fallback
      }
    }
  }

  // 3. Web Audio Synthesizers
  const ctx = getAudioContext()
  const now = ctx.currentTime

  // Fresh instance master gain node strictly scaled to volRatio
  const masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(volRatio * 0.4, now)
  masterGain.connect(ctx.destination)

  switch (soundId) {
    case 'airhorn': {
      // DJ Airhorn synth (multi-oscillator blast)
      const freqs = [311.13, 466.16, 622.25] // Eb chord
      freqs.forEach((f) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f, now)
        osc.frequency.setValueAtTime(f * 1.05, now + 0.08)
        osc.frequency.setValueAtTime(f, now + 0.16)

        gain.gain.setValueAtTime(0.3, now)
        gain.gain.setValueAtTime(0.3, now + 0.8)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1)

        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(now)
        osc.stop(now + 1.2)
      })
      break
    }

    case 'quack': {
      // Duck quack synth
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(450, now)
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.4)

      gain.gain.setValueAtTime(0.5, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(now)
      osc.stop(now + 0.5)
      break
    }

    case 'badumtss': {
      // Drum kick + snare + hi-hat cymbal
      // Kick 1
      const kick1 = ctx.createOscillator()
      const kick1Gain = ctx.createGain()
      kick1.type = 'sine'
      kick1.frequency.setValueAtTime(150, now)
      kick1.frequency.exponentialRampToValueAtTime(40, now + 0.15)
      kick1Gain.gain.setValueAtTime(0.8, now)
      kick1Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
      kick1.connect(kick1Gain)
      kick1Gain.connect(masterGain)
      kick1.start(now)
      kick1.stop(now + 0.2)

      // Kick 2 (Ba-dum)
      const kick2 = ctx.createOscillator()
      const kick2Gain = ctx.createGain()
      kick2.type = 'sine'
      kick2.frequency.setValueAtTime(180, now + 0.25)
      kick2.frequency.exponentialRampToValueAtTime(50, now + 0.45)
      kick2Gain.gain.setValueAtTime(0.8, now + 0.25)
      kick2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
      kick2.connect(kick2Gain)
      kick2Gain.connect(masterGain)
      kick2.start(now + 0.25)
      kick2.stop(now + 0.55)

      // Cymbal Tsss
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1
      }
      const whiteNoise = ctx.createBufferSource()
      whiteNoise.buffer = noiseBuffer
      const cymbalFilter = ctx.createBiquadFilter()
      cymbalFilter.type = 'highpass'
      cymbalFilter.frequency.setValueAtTime(7000, now + 0.5)

      const cymbalGain = ctx.createGain()
      cymbalGain.gain.setValueAtTime(0.6, now + 0.5)
      cymbalGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4)

      whiteNoise.connect(cymbalFilter)
      cymbalFilter.connect(cymbalGain)
      cymbalGain.connect(masterGain)
      whiteNoise.start(now + 0.5)
      whiteNoise.stop(now + 1.5)
      break
    }

    case 'victory': {
      // Fanfare sequence: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        const startTime = now + i * 0.18
        const duration = i === 3 ? 0.8 : 0.2
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0.5, startTime)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(startTime)
        osc.stop(startTime + duration)
      })
      break
    }

    case 'bruh': {
      // Deep bruh formant glide
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, now)
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.6)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(600, now)
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.6)

      gain.gain.setValueAtTime(0.7, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(masterGain)
      osc.start(now)
      osc.stop(now + 0.7)
      break
    }

    case 'parrot': {
      // High-pitched bird squawk chirp
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1400, now)
      osc.frequency.linearRampToValueAtTime(2200, now + 0.1)
      osc.frequency.linearRampToValueAtTime(1100, now + 0.3)
      osc.frequency.linearRampToValueAtTime(1900, now + 0.45)

      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(now)
      osc.stop(now + 0.55)
      break
    }

    case 'tada': {
      // Sparkly chime chord
      const chords = [587.33, 739.99, 880, 1174.66] // D major
      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        const startTime = now + idx * 0.08
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0.4, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9)

        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(startTime)
        osc.stop(startTime + 1.0)
      })
      break
    }

    case 'levelup': {
      // 8-bit level up arpeggio
      const arp = [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760]
      arp.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        const startTime = now + idx * 0.07
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0.2, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)

        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(startTime)
        osc.stop(startTime + 0.16)
      })
      break
    }

    case 'gameover': {
      // Descending sad tones
      const sadNotes = [440, 415.3, 392, 369.99]
      sadNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        const startTime = now + idx * 0.25
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0.4, startTime)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35)

        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(startTime)
        osc.stop(startTime + 0.4)
      })
      break
    }

    default: {
      // Generic beep fallback
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(600, now)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(now)
      osc.stop(now + 0.3)
    }
  }
}

import { useSettingsStore } from '../stores/settingsStore'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playSoundEffect(type: 'message' | 'join' | 'leave' | 'mute' | 'unmute') {
  const settings = useSettingsStore.getState()

  if (type === 'message' && !settings.soundMessage) return
  if ((type === 'join' || type === 'leave') && !settings.soundVoiceJoinLeave) return
  if ((type === 'mute' || type === 'unmute') && !settings.soundMuteToggle) return

  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    const masterVol = (settings.outputVolume / 100) * 0.15

    if (type === 'message') {
      // Soft high chime
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1)
      gain.gain.setValueAtTime(masterVol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'join') {
      // Rising melodic two-tone
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.setValueAtTime(660, now + 0.1)
      gain.gain.setValueAtTime(masterVol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.start(now)
      osc.stop(now + 0.3)
    } else if (type === 'leave') {
      // Descending two-tone
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.setValueAtTime(440, now + 0.1)
      gain.gain.setValueAtTime(masterVol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.start(now)
      osc.stop(now + 0.3)
    } else if (type === 'mute') {
      // Low blip
      osc.type = 'sine'
      osc.frequency.setValueAtTime(320, now)
      gain.gain.setValueAtTime(masterVol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc.start(now)
      osc.stop(now + 0.1)
    } else if (type === 'unmute') {
      // High blip
      osc.type = 'sine'
      osc.frequency.setValueAtTime(540, now)
      gain.gain.setValueAtTime(masterVol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc.start(now)
      osc.stop(now + 0.1)
    }
  } catch (err) {
    console.warn('[soundEffects] Failed to synthesize sound:', err)
  }
}

export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch {
    return false
  }
}

export function showDesktopNotification(title: string, options?: NotificationOptions) {
  const settings = useSettingsStore.getState()
  if (!settings.desktopNotifications) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  try {
    new Notification(title, {
      icon: '/icon.png',
      ...options,
    })
  } catch (err) {
    console.warn('[Notification] Failed to show desktop notification:', err)
  }
}

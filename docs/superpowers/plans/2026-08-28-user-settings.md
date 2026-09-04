# User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive User Settings subsystem featuring persistent user preferences, audio device selection, Voice Activity vs. Push-to-Talk (PTT) with key recording, WebRTC DSP audio processing toggles, desktop notifications & audio chimes, and theme/chat layout personalization.

**Architecture:** A centralized Zustand store (`useSettingsStore`) persisted in `localStorage` feeds preferences into the WebRTC voice engine (`useVoice.ts`), UI sound engine (`soundEffects.ts`), chat rendering (`MessageList.tsx`), and a polished 4-tab settings modal (`UserSettingsModal.tsx`).

**Tech Stack:** React 19, TypeScript, Zustand 5 (persist middleware), Lucide React, Web Audio API, WebRTC MediaDevices API, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-28-user-settings-design.md`

## Global Constraints

- Use standard Web APIs (`navigator.mediaDevices.enumerateDevices`, `Notification`, Web Audio API) with graceful fallbacks.
- Persist settings in `localStorage` under the key `peaceparrot_user_settings`.
- Preserve existing dark/light theme token conventions (`var(--color-...)`).
- Never introduce breaking changes to existing Zustand auth or voice stores.

---

### Task 1: Create Persistent Settings Store

**Files:**
- Create: `web/src/stores/settingsStore.ts`

**Interfaces:**
- Produces: `useSettingsStore` hook exposing state and mutators (`updateSettings`, `resetToDefaults`).

- [ ] **Step 1: Create `web/src/stores/settingsStore.ts`**

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface UserSettingsState {
  // Voice & Audio
  inputDeviceId: string
  outputDeviceId: string
  inputMode: 'voice_activity' | 'push_to_talk'
  pttKey: string
  vadSensitivity: number
  inputVolume: number
  outputVolume: number
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean

  // Notifications & Sound FX
  desktopNotifications: boolean
  soundMessage: boolean
  soundVoiceJoinLeave: boolean
  soundMuteToggle: boolean

  // Appearance
  chatDisplayMode: 'cozy' | 'compact'

  // Actions
  updateSettings: (partial: Partial<UserSettingsState>) => void
  resetToDefaults: () => void
}

export const defaultSettings: Omit<UserSettingsState, 'updateSettings' | 'resetToDefaults'> = {
  inputDeviceId: '',
  outputDeviceId: '',
  inputMode: 'voice_activity',
  pttKey: 'Space',
  vadSensitivity: 30,
  inputVolume: 100,
  outputVolume: 100,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,

  desktopNotifications: false,
  soundMessage: true,
  soundVoiceJoinLeave: true,
  soundMuteToggle: true,

  chatDisplayMode: 'cozy',
}

export const useSettingsStore = create<UserSettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      updateSettings: (partial) => set((state) => ({ ...state, ...partial })),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'peaceparrot_user_settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

- [ ] **Step 2: Verify type check passes**
Run: `npm --prefix web run build` or `npx --prefix web tsc --noEmit`
Expected: PASS with 0 errors.

---

### Task 2: Sound Effects & Notification Utility

**Files:**
- Create: `web/src/utils/soundEffects.ts`

**Interfaces:**
- Produces: `playSoundEffect(type: 'message' | 'join' | 'leave' | 'mute' | 'unmute')` and `requestDesktopNotificationPermission()`.

- [ ] **Step 1: Create `web/src/utils/soundEffects.ts` using Web Audio API synthesis**

```typescript
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

  const permission = await Notification.requestPermission()
  return permission === 'granted'
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
```

- [ ] **Step 2: Verify type check passes**
Run: `npm --prefix web run build`

---

### Task 3: Redesign and Upgrade `UserSettingsModal.tsx`

**Files:**
- Modify: `web/src/components/UserSettingsModal.tsx`

**Interfaces:**
- Consumes: `useSettingsStore`, `useAuthStore`, `useThemeStore`, `soundEffects.ts`.
- Implements 4 tabs:
  1. Profile (Avatar URL + 6 gradient presets, Display Name, Bio, Save).
  2. Voice & Audio (Microphone & Speaker select, Input Mode VA vs PTT with keybind recorder, Sensitivity slider, Volume sliders, WebRTC DSP switches, Live Mic test).
  3. Notifications & Sounds (Desktop notification permission button, individual sound toggles).
  4. Appearance (Dark/Light mode cards, Cozy vs Compact message density).

- [ ] **Step 1: Rewrite `UserSettingsModal.tsx` with full interactive tabs and device enumeration**
- [ ] **Step 2: Verify type check and compile without errors**

---

### Task 4: Integrate Voice Settings & Push-to-Talk (PTT) with `useVoice.ts` and `BottomSidebar.tsx`

**Files:**
- Modify: `web/src/hooks/useVoice.ts`
- Modify: `web/src/components/BottomSidebar.tsx`

**Interfaces:**
- `useVoice.ts`: Read `inputDeviceId`, `echoCancellation`, `noiseSuppression`, `autoGainControl` from `useSettingsStore` when requesting user media.
- Add global keyboard listener for `pttKey` when `inputMode === 'push_to_talk'`.
- `BottomSidebar.tsx`: Play click sounds using `playSoundEffect('mute' | 'unmute')` on mute/deafen toggle.

- [ ] **Step 1: Update `useVoice.ts` to apply settings constraints and PTT handling**
- [ ] **Step 2: Wire up sound effects on mute/deafen toggles in `BottomSidebar.tsx`**
- [ ] **Step 3: Run build check**

---

### Task 5: Integrate Chat Density Mode in `MessageList.tsx` & Verification

**Files:**
- Modify: `web/src/components/MessageList.tsx`

**Interfaces:**
- Consumes: `chatDisplayMode` from `useSettingsStore`.
- If `'compact'`, render compact message view (timestamp + inline author + single-line message body); if `'cozy'`, render full avatar card layout.

- [ ] **Step 1: Update `MessageList.tsx` to conditionally adjust message padding and avatar rendering based on `chatDisplayMode`**
- [ ] **Step 2: Run verification build and test UI**
- [ ] **Step 3: Update `plans/TASKS.md` milestone tracking**

---

## Execution Options

Two execution paths available:
1. **Subagent-Driven (recommended)** - Execute each task with dedicated subagents and review gates.
2. **Inline Execution** - Execute tasks directly in this session with checkpoints.

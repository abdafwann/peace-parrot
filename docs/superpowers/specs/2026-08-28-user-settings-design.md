# PeaceParrot — User Settings Design Specification

**Status:** Approved  
**Date:** 2026-08-28  
**Scope:** Frontend User Settings (State, UI Modal, Audio/PTT, Notifications, Appearance)

---

## 1. Overview

This specification defines the complete User Settings subsystem for the PeaceParrot desktop client. It encompasses profile management, voice input/output device handling, Voice Activity vs. Push-to-Talk (PTT) input modes, audio enhancement DSP switches, desktop notifications with sound effects, and UI appearance personalization.

---

## 2. Architecture & State Management

### 2.1 Settings Store (`web/src/stores/settingsStore.ts`)
A dedicated Zustand store with `persist` middleware (`localStorage` key: `peaceparrot_user_settings`) managing client-side preferences:

- **Voice & Audio**:
  - `inputDeviceId: string` — Selected microphone device ID.
  - `outputDeviceId: string` — Selected audio playback output device ID (via `setSinkId` where supported).
  - `inputMode: 'voice_activity' | 'push_to_talk'` — Voice detection mode.
  - `pttKey: string` — Shortcut key identifier (e.g. `'Space'`, `'Control'`, `'KeyV'`).
  - `vadSensitivity: number` — Voice activity threshold (0-100, default: 50).
  - `inputVolume: number` — Microphone gain multiplier (0-100, default: 100).
  - `outputVolume: number` — Speaker gain multiplier (0-200, default: 100).
  - `echoCancellation: boolean` — WebRTC DSP echo cancellation (default: true).
  - `noiseSuppression: boolean` — WebRTC DSP noise suppression (default: true).
  - `autoGainControl: boolean` — WebRTC DSP automatic gain control (default: true).

- **Notifications & Sound FX**:
  - `desktopNotifications: boolean` — OS-level notification toggle (default: false until granted).
  - `soundMessage: boolean` — Audible chime on new incoming chat message (default: true).
  - `soundVoiceJoinLeave: boolean` — Chime when users join or leave voice channels (default: true).
  - `soundMuteToggle: boolean` — Soft click feedback on mute/deafen toggles (default: true).

- **Appearance**:
  - `chatDisplayMode: 'cozy' | 'compact'` — Message layout density (default: 'cozy').

---

## 3. UI Components & Modal Layout (`UserSettingsModal.tsx`)

The modal is organized into 4 primary tabs:

### 3.1 Tab 1: My Account & Profile
- **Preview Card**: User banner with avatar, live display name, `@username` tag, and bio.
- **Display Name Input**: Updates user's public display name.
- **Bio Textarea**: Multiline bio (max 190 characters).
- **Avatar Customization**:
  - Custom image URL input.
  - Quick-select gradient & color presets.
- **Account Actions**: Logout action with confirmation.
- **Persistence**: Synchronizes with backend `PATCH /api/users/me`.

### 3.2 Tab 2: Voice & Audio
- **Device Selectors**:
  - Input Device dropdown populated via `navigator.mediaDevices.enumerateDevices()`.
  - Output Device dropdown populated via `navigator.mediaDevices.enumerateDevices()`.
- **Input Mode Selection**:
  - Toggle between **Voice Activity** and **Push-to-Talk**.
  - If **Voice Activity**: Sensitivity slider with real-time meter indicator.
  - If **Push-to-Talk**: Key recorder widget ("Press any key to bind shortcut").
- **Volume Controls**:
  - Input volume slider (0% to 100%).
  - Output volume slider (0% to 200%).
- **Enhancements (WebRTC DSP)**:
  - Echo Cancellation switch.
  - Noise Suppression switch.
  - Automatic Gain Control switch.
- **Live Mic Test**:
  - "Let's Check" button rendering a real-time responsive VU meter with colored peak indicators.

### 3.3 Tab 3: Notifications & Sounds
- **Desktop Notifications**:
  - Status indicator (Permission Granted / Denied / Default).
  - Button to trigger browser `Notification.requestPermission()`.
- **Sound Effects**:
  - Message notification chimes toggle.
  - Voice channel join/leave chimes toggle.
  - Mute/unmute click sound toggle.

### 3.4 Tab 4: Appearance
- **Theme Selection**:
  - Dark Mode vs. Light Mode cards with visual checkmark indicator.
- **Message Density**:
  - Cozy mode (generous padding, full avatars).
  - Compact mode (single-line dense IRC style).

---

## 4. Audio Engine Integration (`useVoice.ts`)

- **Constraint Resolution**: Whenever `getUserMedia` is triggered, audio constraints are derived dynamically from `settingsStore`:
  ```typescript
  const constraints: MediaStreamConstraints = {
    audio: {
      deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined,
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
    },
    video: false,
  }
  ```
- **Push-to-Talk Event Listener**:
  - Global `keydown` / `keyup` listeners active when `inputMode === 'push_to_talk'`.
  - On `keydown` of `pttKey`, voice track is enabled (`track.enabled = true`).
  - On `keyup` of `pttKey`, voice track is disabled (`track.enabled = false`).

---

## 5. Verification Plan

1. **State Persistence**: Verify settings modifications persist in `localStorage` across page reloads.
2. **Audio Hardware Selection**: Verify changing audio input device re-acquires media stream with chosen `deviceId`.
3. **PTT & Mic Test**: Verify pressing the recorded PTT key unmutes mic and triggers speaking indicator.
4. **Notifications**: Verify requesting desktop notifications prompts browser permissions and saves preference.
5. **Theme & Density**: Verify theme and chat display mode switch instantaneously across the interface.

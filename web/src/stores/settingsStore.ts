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
  soundboardVolume: number
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
  soundboardVolume: 80,
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

import { create } from 'zustand'

// ============================================================================
// Types - matches spec-voice.md Section 3.1 & Discord Standard Audio Controls
// ============================================================================

export interface VoiceParticipantState {
  // Server-synced (broadcasted via WebSocket)
  muted: boolean           // Self-muted OR admin-muted
  deafened: boolean        // Self-deafened
  isScreenSharing: boolean // User is sharing their screen
  joinedAt: number         // Timestamp
  channelId?: string
  username?: string
  displayName?: string
  avatarUrl?: string

  // Client-side local (never sent to server, persistent in localStorage)
  localMuted: boolean      // YOU muted this user locally
  volume: number           // Your local volume for this user (0.0 - 2.0, 1.0 = 100%, 2.0 = 200%)
  isSpeaking: boolean      // Detected by useSpeakingDetection
}

export interface VoiceState {
  // Current channel
  channelId: string | null

  // Remote participants (Map for O(1) lookups)
  participants: Map<string, VoiceParticipantState>

  // UI state
  isPanelExpanded: boolean

  // Your own state (synced to others)
  selfMuted: boolean
  selfDeafened: boolean

  // Screen share
  isScreenSharing: boolean

  // Connection state
  isConnecting: boolean
  isConnected: boolean
}

// Helpers for localStorage user volume persistence
export function getSavedUserVolume(userId: string): number {
  if (typeof window === 'undefined') return 1.0
  try {
    const raw = localStorage.getItem('peaceparrot_user_volumes')
    if (!raw) return 1.0
    const parsed = JSON.parse(raw)
    const val = parsed[userId]
    return typeof val === 'number' && val >= 0 && val <= 2 ? val : 1.0
  } catch {
    return 1.0
  }
}

export function saveUserVolume(userId: string, volume: number) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem('peaceparrot_user_volumes')
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[userId] = Math.max(0, Math.min(2.0, volume))
    localStorage.setItem('peaceparrot_user_volumes', JSON.stringify(parsed))
  } catch {}
}

export function getSavedUserLocalMute(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('peaceparrot_user_local_mutes')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return Boolean(parsed[userId])
  } catch {
    return false
  }
}

export function saveUserLocalMute(userId: string, localMuted: boolean) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem('peaceparrot_user_local_mutes')
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[userId] = localMuted
    localStorage.setItem('peaceparrot_user_local_mutes', JSON.stringify(parsed))
  } catch {}
}

// ============================================================================
// Actions
// ============================================================================

interface VoiceActions {
  // Channel actions
  setChannelId: (channelId: string | null) => void

  // UI actions
  togglePanel: () => void
  setPanelExpanded: (expanded: boolean) => void

  // Self state actions
  setSelfMuted: (muted: boolean) => void
  setSelfDeafened: (deafened: boolean) => void
  setIsScreenSharing: (sharing: boolean) => void
  setIsConnecting: (connecting: boolean) => void
  setIsConnected: (connected: boolean) => void

  // Participant actions
  addParticipant: (userId: string, participant: Partial<VoiceParticipantState>) => void
  removeParticipant: (userId: string) => void
  updateParticipant: (userId: string, updates: Partial<VoiceParticipantState>) => void
  setParticipants: (participants: Map<string, VoiceParticipantState>) => void

  // Per-user volume and local mute control (0.0 - 2.0)
  setUserVolume: (userId: string, volume: number) => void
  setUserLocalMute: (userId: string, localMuted: boolean) => void

  // Speaking detection
  setParticipantSpeaking: (userId: string, isSpeaking: boolean) => void

  // Leave channel (cleans up local state, keeps other participants)
  leaveLocalChannel: (localUserId?: string) => void

  // Full reset (cleanup)
  reset: () => void
}

export type VoiceStore = VoiceState & VoiceActions

// ============================================================================
// Initial State
// ============================================================================

const initialState: VoiceState = {
  channelId: null,
  participants: new Map(),
  isPanelExpanded: true,
  selfMuted: false,
  selfDeafened: false,
  isScreenSharing: false,
  isConnecting: false,
  isConnected: false,
}

// ============================================================================
// Store
// ============================================================================

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  ...initialState,

  setChannelId: (channelId) => set({ channelId }),

  togglePanel: () => set((state) => ({ isPanelExpanded: !state.isPanelExpanded })),
  setPanelExpanded: (expanded) => set({ isPanelExpanded: expanded }),

  setSelfMuted: (muted) => {
    set({ selfMuted: muted })
    // Update local participant state
    const { channelId, participants } = get()
    if (channelId) {
      const localParticipant = participants.get('local')
      if (localParticipant) {
        set({
          participants: new Map(participants).set('local', {
            ...localParticipant,
            muted,
          }),
        })
      }
    }
  },

  setSelfDeafened: (deafened) => {
    set((state) => ({
      selfDeafened: deafened,
      selfMuted: deafened ? true : state.selfMuted,
    }))
    // Update local participant state
    const { channelId, participants } = get()
    if (channelId) {
      const localParticipant = participants.get('local')
      if (localParticipant) {
        set({
          participants: new Map(participants).set('local', {
            ...localParticipant,
            deafened,
            muted: deafened ? true : localParticipant.muted,
          }),
        })
      }
    }
  },

  setIsScreenSharing: (sharing) => set({ isScreenSharing: sharing }),
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setIsConnected: (connected) => set({ isConnected: connected }),

  addParticipant: (userId, participant) => {
    set((state) => {
      const newParticipants = new Map(state.participants)
      const existing = newParticipants.get(userId)
      const persistentVol = getSavedUserVolume(userId)
      const persistentMute = getSavedUserLocalMute(userId)

      newParticipants.set(userId, {
        muted: false,
        deafened: false,
        isScreenSharing: false,
        joinedAt: Date.now(),
        localMuted: persistentMute,
        volume: persistentVol,
        isSpeaking: false,
        ...existing,
        ...participant,
      })
      return { participants: newParticipants }
    })
  },

  removeParticipant: (userId) => {
    set((state) => {
      const newParticipants = new Map(state.participants)
      newParticipants.delete(userId)
      return { participants: newParticipants }
    })
  },

  updateParticipant: (userId, updates) => {
    set((state) => {
      const newParticipants = new Map(state.participants)
      const existing = newParticipants.get(userId)
      if (existing) {
        newParticipants.set(userId, { ...existing, ...updates })
      }
      return { participants: newParticipants }
    })
  },

  setParticipants: (participants) => set({ participants }),

  setUserVolume: (userId, volume) => {
    const clamped = Math.max(0, Math.min(2.0, volume))
    saveUserVolume(userId, clamped)

    set((state) => {
      const newParticipants = new Map(state.participants)
      const existing = newParticipants.get(userId)
      if (existing) {
        newParticipants.set(userId, { ...existing, volume: clamped })
      }
      return { participants: newParticipants }
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('user-volume-changed', {
          detail: { userId, volume: clamped },
        })
      )
    }
  },

  setUserLocalMute: (userId, localMuted) => {
    saveUserLocalMute(userId, localMuted)

    set((state) => {
      const newParticipants = new Map(state.participants)
      const existing = newParticipants.get(userId)
      if (existing) {
        newParticipants.set(userId, { ...existing, localMuted })
      }
      return { participants: newParticipants }
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('user-volume-changed', {
          detail: { userId, localMuted },
        })
      )
    }
  },

  setParticipantSpeaking: (userId, isSpeaking) => {
    set((state) => {
      const newParticipants = new Map(state.participants)
      const existing = newParticipants.get(userId)
      if (existing) {
        newParticipants.set(userId, { ...existing, isSpeaking })
      }
      return { participants: newParticipants }
    })
  },

  leaveLocalChannel: (localUserId?: string) => {
    set((state) => {
      const newParticipants = new Map(state.participants)
      if (localUserId) {
        newParticipants.delete(localUserId)
      }
      newParticipants.delete('local')
      return {
        channelId: null,
        isConnected: false,
        isConnecting: false,
        isScreenSharing: false,
        participants: newParticipants,
      }
    })
  },

  reset: () => set(initialState),
}))

// ============================================================================
// Selectors
// ============================================================================

export const useIsInVoice = () => useVoiceStore((state) => state.channelId !== null)
export const useVoiceChannelId = () => useVoiceStore((state) => state.channelId)
export const useVoiceParticipants = () => useVoiceStore((state) => state.participants)
export const useParticipantCount = () => useVoiceStore((state) => state.participants.size)

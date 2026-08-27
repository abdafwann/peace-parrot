import { create } from 'zustand'

// ============================================================================
// Types - matches spec-voice.md Section 3.1
// ============================================================================

export interface VoiceParticipantState {
  // Server-synced (broadcasted via WebSocket)
  muted: boolean           // Self-muted OR admin-muted
  deafened: boolean        // Self-deafened
  isScreenSharing: boolean // User is sharing their screen
  joinedAt: number          // Timestamp

  // Client-side local (never sent to server)
  localMuted: boolean      // YOU muted this user locally
  volume: number           // Your local volume (0.0 - 2.0)
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

  // Speaking detection
  setParticipantSpeaking: (userId: string, isSpeaking: boolean) => void

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
      newParticipants.set(userId, {
        muted: false,
        deafened: false,
        isScreenSharing: false,
        joinedAt: Date.now(),
        localMuted: false,
        volume: 1.0,
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

  reset: () => set(initialState),
}))

// ============================================================================
// Selectors
// ============================================================================

export const useIsInVoice = () => useVoiceStore((state) => state.channelId !== null)
export const useVoiceChannelId = () => useVoiceStore((state) => state.channelId)
export const useVoiceParticipants = () => useVoiceStore((state) => state.participants)
export const useParticipantCount = () => useVoiceStore((state) => state.participants.size)

import { create } from 'zustand'

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  topic?: string
  position: number
}

interface ChannelState {
  channels: Channel[]
  activeChannelId: string | null

  // Actions
  setChannels: (channels: Channel[]) => void
  addChannel: (channel: Channel) => void
  updateChannel: (id: string, updates: Partial<Channel>) => void
  removeChannel: (id: string) => void
  setActiveChannel: (id: string | null) => void
  reorderChannels: (channels: Channel[], token?: string) => Promise<boolean>
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  activeChannelId: null,

  setChannels: (channels) => set({ channels }),

  addChannel: (channel) =>
    set((state) => ({
      channels: [...state.channels, channel].sort((a, b) => a.position - b.position),
    })),

  updateChannel: (id, updates) =>
    set((state) => ({
      channels: state.channels.map((ch) =>
        ch.id === id ? { ...ch, ...updates } : ch
      ),
    })),

  removeChannel: (id) =>
    set((state) => ({
      channels: state.channels.filter((ch) => ch.id !== id),
      activeChannelId: state.activeChannelId === id ? null : state.activeChannelId,
    })),

  setActiveChannel: (id) => set({ activeChannelId: id }),

  reorderChannels: async (newChannels: Channel[], token?: string) => {
    // 1. Assign index-based sequential positions
    const updatedWithPositions = newChannels.map((ch, idx) => ({
      ...ch,
      position: idx,
    }))

    // 2. Optimistically update local store
    set({ channels: updatedWithPositions })

    if (!token) return true

    // 3. Persist to backend
    try {
      const payload = updatedWithPositions.map((ch) => ({
        id: ch.id,
        position: ch.position,
      }))

      const res = await fetch('http://localhost:8080/api/channels/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        // Fallback to individual PATCH if reorder endpoint is unreachable
        for (const item of payload) {
          await fetch(`http://localhost:8080/api/channels/${item.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ position: item.position }),
          })
        }
      }
      return true
    } catch (err) {
      console.error('Failed to persist channel reorder:', err)
      return false
    }
  },
}))

// Selectors
export const useChannels = () => useChannelStore((state) => state.channels)
export const useActiveChannel = () => {
  const channels = useChannelStore((state) => state.channels)
  const activeId = useChannelStore((state) => state.activeChannelId)
  return channels.find((ch) => ch.id === activeId) ?? null
}

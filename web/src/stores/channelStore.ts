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
}))

// Selectors
export const useChannels = () => useChannelStore((state) => state.channels)
export const useActiveChannel = () => {
  const channels = useChannelStore((state) => state.channels)
  const activeId = useChannelStore((state) => state.activeChannelId)
  return channels.find((ch) => ch.id === activeId) ?? null
}

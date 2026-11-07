import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { apiFetch } from '../utils/config'
import { createBlockSession } from '../utils/blockSession'

const session = createBlockSession()

interface BlockState {
  sessionToken: string | null
  blocked: Set<string>
  loaded: boolean
  loading: boolean
  error: string | null
  reset: (token: string | null) => void
  fetchBlocks: () => Promise<void>
  changeBlock: (id: string, block: boolean) => Promise<boolean>
}

export const useBlockStore = create<BlockState>((set, get) => ({
  sessionToken: null, blocked: new Set(), loaded: false, loading: false, error: null,
  reset: (token) => { session.reset(token); set({ sessionToken: token, blocked: new Set(), loaded: false, loading: false, error: null }) },
  fetchBlocks: async () => {
    const token = useAuthStore.getState().token
    if (!token || get().sessionToken !== token) return
    set({ loading: true, error: null })
    try {
      const ids = await session.load(token, async () => {
        const response = await apiFetch('/api/users/me/blocks')
        if (!response.ok) throw new Error('Failed to load blocked users')
        const data: unknown = await response.json()
        if (!Array.isArray(data) || !data.every((id) => typeof id === 'string')) throw new Error('Invalid block list')
        return data as string[]
      })
      if (ids && useAuthStore.getState().token === token) set({ blocked: new Set(ids), loaded: true, loading: false, error: null })
    } catch {
      if (useAuthStore.getState().token === token) set({ loaded: false, loading: false, error: 'Failed to load blocked users. Retry.' })
    }
  },
  changeBlock: async (id, block) => {
    const token = useAuthStore.getState().token
    if (!token || get().sessionToken !== token || !get().loaded) return false
    try {
      const response = await apiFetch(`/api/users/me/blocks/${encodeURIComponent(id)}`, { method: block ? 'PUT' : 'DELETE' })
      if (!response.ok || useAuthStore.getState().token !== token) return false
      await get().fetchBlocks()
      return useAuthStore.getState().token === token && !get().error
    } catch { return false }
  },
}))

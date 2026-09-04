import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { API_BASE_URL } from '../utils/config'

export interface ServerSettings {
  id: string
  name: string
  description?: string
  iconUrl?: string
  iconPublicId?: string
  ownerId?: string
  inviteExpiryDefault?: number
  slowModeSeconds: number
  createdAt?: string
  updatedAt?: string
}

export interface Role {
  id: string
  name: string
  color: string
  iconUrl?: string
  iconPublicId?: string
  position: number
  permissions: number
  createdAt?: string
  updatedAt?: string
}

export interface BanInfo {
  id: string
  userId: string
  username: string
  avatarUrl?: string
  bannedBy: string
  reason?: string
  createdAt: string
}

interface ServerState {
  settings: ServerSettings | null
  bans: BanInfo[]
  roles: Role[]
  isLoading: boolean
  error: string | null

  fetchSettings: () => Promise<void>
  updateSettings: (name: string, description: string, slowModeSeconds: number) => Promise<boolean>
  uploadIcon: (file: File) => Promise<boolean>
  fetchBans: () => Promise<void>
  banUser: (userId: string) => Promise<boolean>
  unbanUser: (userId: string) => Promise<boolean>
  kickUser: (userId: string) => Promise<boolean>
  muteUser: (userId: string, durationMinutes: number) => Promise<boolean>
  unmuteUser: (userId: string) => Promise<boolean>
  updateMemberRole: (userId: string, role: string) => Promise<boolean>
  fetchRoles: () => Promise<void>
  createRole: (name: string, color: string, iconUrl: string, permissions: number) => Promise<Role | null>
  updateRole: (id: string, name: string, color: string, iconUrl: string, permissions: number) => Promise<boolean>
  uploadRoleIcon: (id: string, file: File) => Promise<string | null>
  deleteRole: (id: string) => Promise<boolean>
}

export const useServerStore = create<ServerState>((set) => ({
  settings: {
    id: 'default',
    name: 'PeaceParrot Lounge',
    description: 'The official community server for PeaceParrot users.',
    slowModeSeconds: 0,
  },
  bans: [],
  roles: [
    { id: 'role-admin', name: 'Admin', color: '#5865F2', iconUrl: '👑', position: 1, permissions: 1023 },
    { id: 'role-mod', name: 'Moderator', color: '#FEE75C', iconUrl: '🛡️', position: 2, permissions: 511 },
    { id: 'role-member', name: 'Member', color: '#99AAB5', iconUrl: '', position: 3, permissions: 67 },
  ],
  isLoading: false,
  error: null,

  fetchRoles: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/server/roles`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          set({ roles: data })
        }
      }
    } catch (err) {
      console.error('[ServerStore] Failed to fetch roles:', err)
    }
  },

  createRole: async (name: string, color: string, iconUrl: string, permissions: number) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, color, iconUrl, permissions }),
      })
      if (res.ok) {
        const newRole = await res.json()
        set((state) => ({ roles: [...state.roles, newRole] }))
        return newRole
      }
      return null
    } catch {
      return null
    }
  },

  updateRole: async (id: string, name: string, color: string, iconUrl: string, permissions: number) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/roles/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, color, iconUrl, permissions }),
      })
      if (res.ok) {
        const updated = await res.json()
        set((state) => ({
          roles: state.roles.map((r) => (r.id === id ? updated : r)),
        }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  uploadRoleIcon: async (id: string, file: File) => {
    try {
      const token = useAuthStore.getState().token
      const formData = new FormData()
      formData.append('icon', file)

      const res = await fetch(`${API_BASE_URL}/api/server/roles/${id}/icon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.iconUrl) {
          set((state) => ({
            roles: state.roles.map((r) => (r.id === id ? { ...r, iconUrl: data.iconUrl } : r)),
          }))
          return data.iconUrl
        }
      }
      return null
    } catch {
      return null
    }
  },

  deleteRole: async (id: string) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/roles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        set((state) => ({ roles: state.roles.filter((r) => r.id !== id) }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  fetchSettings: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/server`)
      if (res.ok) {
        const data = await res.json()
        set({ settings: data })
      }
    } catch (err) {
      console.error('[ServerStore] Failed to fetch settings:', err)
    }
  },

  updateSettings: async (name, description, slowModeSeconds) => {
    set({ isLoading: true, error: null })
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          description,
          slowModeSeconds,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        set({ settings: data, isLoading: false })
        return true
      }
      set({ error: 'Failed to update settings', isLoading: false })
      return false
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return false
    }
  },

  uploadIcon: async (file: File) => {
    set({ isLoading: true, error: null })
    try {
      const token = useAuthStore.getState().token
      const formData = new FormData()
      formData.append('icon', file)

      const res = await fetch(`${API_BASE_URL}/api/server/icon`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        set((state) => ({
          settings: state.settings ? { ...state.settings, iconUrl: data.iconUrl } : null,
          isLoading: false,
        }))
        return true
      }
      set({ error: 'Failed to upload icon', isLoading: false })
      return false
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return false
    }
  },

  fetchBans: async () => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/bans`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        set({ bans: data || [] })
      }
    } catch (err) {
      console.error('[ServerStore] Failed to fetch bans:', err)
    }
  },

  banUser: async (userId: string) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/bans/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  },

  unbanUser: async (userId: string) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/bans/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  },

  kickUser: async (userId: string) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/kicks/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  },

  muteUser: async (userId: string, durationMinutes: number) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/mutes/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ durationMinutes }),
      })
      return res.ok
    } catch {
      return false
    }
  },

  unmuteUser: async (userId: string) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/mutes/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  },

  updateMemberRole: async (userId: string, role: string) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`${API_BASE_URL}/api/server/members/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      })
      return res.ok
    } catch {
      return false
    }
  },
}))

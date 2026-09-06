import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  bannerUrl?: string
  bio?: string
  role?: string
}

export interface RawUserData {
  id?: string
  ID?: string
  username?: string
  Username?: string
  displayName?: string
  DisplayName?: string
  avatarUrl?: string
  AvatarURL?: string
  bannerUrl?: string
  BannerURL?: string
  bio?: string
  Bio?: string
  role?: string
  Role?: string
}

function normalizeUser(raw: RawUserData): User {
  const username = raw.username || raw.Username || ''
  return {
    id: raw.id || raw.ID || '',
    username,
    displayName: raw.displayName || raw.DisplayName || username || 'User',
    avatarUrl: raw.avatarUrl || raw.AvatarURL,
    bannerUrl: raw.bannerUrl || raw.BannerURL,
    bio: raw.bio || raw.Bio,
    role: raw.role || raw.Role || 'Member',
  }
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean

  login: (user: RawUserData | User, token: string) => void
  logout: () => void
  setUser: (user: RawUserData | User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (rawUser, token) => {
        set({ user: normalizeUser(rawUser), token, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (rawUser) => {
        set({ user: normalizeUser(rawUser) })
      },
    }),
    {
      name: 'peace-parrot-auth',
    }
  )
)

// Selector hooks
export const useAuth = () => useAuthStore((state) => state.isAuthenticated)
export const useUser = () => useAuthStore((state) => state.user)
export const useToken = () => useAuthStore((state) => state.token)
export const getTokenFromStore = () => useAuthStore.getState().token

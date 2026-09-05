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

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean

  // Actions
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (rawUser, token) => {
        const u: User = {
          id: (rawUser as any)?.id || (rawUser as any)?.ID || '',
          username: (rawUser as any)?.username || (rawUser as any)?.Username || '',
          displayName:
            (rawUser as any)?.displayName ||
            (rawUser as any)?.DisplayName ||
            (rawUser as any)?.username ||
            (rawUser as any)?.Username ||
            'User',
          avatarUrl: (rawUser as any)?.avatarUrl || (rawUser as any)?.AvatarURL,
          bannerUrl: (rawUser as any)?.bannerUrl || (rawUser as any)?.BannerURL,
          bio: (rawUser as any)?.bio || (rawUser as any)?.Bio,
          role: (rawUser as any)?.role || (rawUser as any)?.Role || 'Member',
        }
        set({ user: u, token, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (rawUser) => {
        const u: User = {
          id: (rawUser as any)?.id || (rawUser as any)?.ID || '',
          username: (rawUser as any)?.username || (rawUser as any)?.Username || '',
          displayName:
            (rawUser as any)?.displayName ||
            (rawUser as any)?.DisplayName ||
            (rawUser as any)?.username ||
            (rawUser as any)?.Username ||
            'User',
          avatarUrl: (rawUser as any)?.avatarUrl || (rawUser as any)?.AvatarURL,
          bannerUrl: (rawUser as any)?.bannerUrl || (rawUser as any)?.BannerURL,
          bio: (rawUser as any)?.bio || (rawUser as any)?.Bio,
          role: (rawUser as any)?.role || (rawUser as any)?.Role || 'Member',
        }
        set({ user: u })
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

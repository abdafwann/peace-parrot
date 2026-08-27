import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  bio?: string
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

      login: (user, token) => set({ user, token, isAuthenticated: true }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      setUser: (user) => set({ user }),
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

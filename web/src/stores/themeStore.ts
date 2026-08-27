import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark', // Default to dark as per PRD

      setTheme: (theme) => {
        set({ theme })
        // Apply theme to document
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme)
        }
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: newTheme })
        // Apply theme to document
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', newTheme)
        }
      },
    }),
    {
      name: 'peace-parrot-theme',
    }
  )
)

// Hook for getting current theme
export const useTheme = () => useThemeStore((state) => state.theme)

// Initialize theme on load (call this once at app startup)
export const initializeTheme = () => {
  const { theme } = useThemeStore.getState()
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

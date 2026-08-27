import { ReactNode } from 'react'
import { Bird, Sun, Moon } from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'
import { ChannelList } from './ChannelList'

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <div className="flex h-full">
      {/* Server sidebar - 72px */}
      <aside
        className="w-[72px] flex flex-col items-center py-3 gap-2 shrink-0"
        style={{ background: 'var(--color-bg-secondary)' }}
      >
        {/* Home server - PeaceParrot */}
        <div className="group relative">
          <a
            href="#"
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl animate-glow"
            style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))' }}
          >
            <Bird size={24} className="text-white" />
          </a>
          {/* Tooltip */}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
            PeaceParrot Home
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[var(--color-bg-elevated)]" />
          </div>
        </div>

        {/* Separator */}
        <div className="w-8 h-px my-1 rounded-full" style={{ background: 'var(--color-border-default)' }} />

        {/* Demo servers */}
        <ServerIcon name="Gaming" color="#23a559" />
        <ServerIcon name="Music" color="#f0b232" />
        <ServerIcon name="Tech" color="#00b0f4" />

        {/* Separator */}
        <div className="w-8 h-px my-1 rounded-full" style={{ background: 'var(--color-border-default)' }} />

        {/* Add server button */}
        <div className="group relative">
          <button
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl hover:bg-[var(--color-parrot-green)]"
            style={{ background: 'var(--color-bg-tertiary)' }}
          >
            <span className="text-xl font-light text-[var(--color-parrot-green)] group-hover:text-white transition-colors">+</span>
          </button>
          {/* Tooltip */}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
            Add a server
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[var(--color-bg-elevated)]" />
          </div>
        </div>
      </aside>

      {/* Channel sidebar - 240px */}
      <nav
        className="w-[240px] flex flex-col shrink-0"
        style={{ background: 'var(--color-bg-secondary)' }}
      >
        {/* Server name header */}
        <div className="h-12 px-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h2 className="font-semibold text-[var(--color-text-primary)]">PeaceParrot</h2>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-bg-hover)]"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun size={16} className="text-[var(--color-text-secondary)]" />
            ) : (
              <Moon size={16} className="text-[var(--color-text-secondary)]" />
            )}
          </button>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          <ChannelList />
        </div>

        {/* User panel at bottom */}
        <div
          className="h-12 px-2 flex items-center gap-2 shrink-0"
          style={{ borderTop: '1px solid var(--color-border-default)', background: 'var(--color-bg-tertiary)' }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))' }}>
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">Username</p>
            <p className="text-xs text-[var(--color-text-muted)]">Online</p>
          </div>
          <button className="p-1 rounded hover:bg-[var(--color-bg-hover)] transition-colors" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-bg-primary)' }}>
        {children}
      </main>

      {/* Member sidebar - 240px (hidden on smaller screens) */}
      <aside
        className="w-[240px] hidden 2xl:block shrink-0"
        style={{ background: 'var(--color-bg-secondary)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Online — 1
          </h3>
        </div>
        <div className="p-2 overflow-y-auto flex-1">
          {/* Current user */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-bg-hover)]">
            <div className="relative">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))' }}>
                U
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--color-parrot-green)] border-2 border-[var(--color-bg-secondary)]" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Username</span>
          </div>
        </div>
      </aside>
    </div>
  )
}

// Server icon component for the sidebar
function ServerIcon({ name, color }: { name: string; color: string }) {
  return (
    <div className="group relative">
      <button
        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl"
        style={{ background: color }}
      >
        <span className="text-white font-semibold text-sm">{name[0]}</span>
      </button>
      {/* Tooltip */}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
        {name}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[var(--color-bg-elevated)]" />
      </div>
    </div>
  )
}

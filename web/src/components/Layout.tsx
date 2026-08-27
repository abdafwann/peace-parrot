import { ReactNode } from 'react'
import { Bird, Sun, Moon } from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'
import { ChannelList } from './ChannelList'
import { BottomSidebar } from './BottomSidebar'
import { MemberList } from './MemberList'

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <div className="flex h-full overflow-hidden">
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

        {/* Bottom Sidebar with Voice Connection status & User Profile */}
        <BottomSidebar />
      </nav>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-bg-primary)' }}>
        {children}
      </main>

      {/* Member sidebar - 240px */}
      <MemberList />
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

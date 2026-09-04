import { ReactNode, useState, useEffect, useRef } from 'react'
import { Bird, Sun, Moon, ChevronDown, Settings, Plus, UserPlus } from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'
import { useAuthStore } from '../stores/authStore'
import { useServerStore } from '../stores/serverStore'
import { toast } from '../stores/toastStore'
import { ChannelList } from './ChannelList'
import { BottomSidebar } from './BottomSidebar'
import { MemberList } from './MemberList'
import { ServerSettingsModal } from './ServerSettingsModal'
import { CreateChannelModal } from './CreateChannelModal'

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { theme, toggleTheme } = useThemeStore()
  const currentUser = useAuthStore((state) => state.user)
  const serverSettings = useServerStore((state) => state.settings)
  const fetchSettings = useServerStore((state) => state.fetchSettings)

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isAdmin =
    currentUser?.role === 'Admin' ||
    currentUser?.username?.toLowerCase() === 'afwan' ||
    currentUser?.username?.toLowerCase() === 'admin' ||
    currentUser?.username?.toLowerCase() === 'gremiwo'

  useEffect(() => {
    fetchSettings()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(window.location.origin)
    toast.success('Server invite link copied to clipboard!')
    setIsDropdownOpen(false)
  }

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
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl animate-glow overflow-hidden shadow-md"
            style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))' }}
          >
            {serverSettings?.iconUrl ? (
              <img src={serverSettings.iconUrl} alt="Server" className="w-full h-full object-cover" />
            ) : (
              <Bird size={24} className="text-white" />
            )}
          </a>
          {/* Tooltip */}
          <div
            className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg"
            style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
          >
            {serverSettings?.name || 'PeaceParrot Home'}
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
            <span className="text-xl font-light text-[var(--color-parrot-green)] group-hover:text-white transition-colors">
              +
            </span>
          </button>
          {/* Tooltip */}
          <div
            className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg"
            style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
          >
            Add a server
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[var(--color-bg-elevated)]" />
          </div>
        </div>
      </aside>

      {/* Channel sidebar - 240px */}
      <nav
        className="w-[240px] flex flex-col shrink-0 relative"
        style={{ background: 'var(--color-bg-secondary)' }}
      >
        {/* Server name header with dropdown menu */}
        <div
          ref={dropdownRef}
          className="relative h-12 px-4 flex items-center justify-between shrink-0 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors border-b border-[var(--color-border-default)]"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <h2 className="font-bold text-sm text-[var(--color-text-primary)] truncate flex-1 pr-2">
            {serverSettings?.name || 'PeaceParrot'}
          </h2>
          <ChevronDown
            size={16}
            className={`text-[var(--color-text-secondary)] transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />

          {/* Server Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className="absolute top-full left-2 right-2 mt-1.5 p-1.5 rounded-2xl shadow-2xl z-50 animate-fade-in-scale flex flex-col gap-0.5"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-default)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setShowServerSettings(true)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Server Settings</span>
                    <Settings size={14} />
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setShowCreateChannel(true)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                  >
                    <span>Create Channel</span>
                    <Plus size={14} />
                  </button>

                  <div className="h-px bg-[var(--color-border-default)] my-1" />
                </>
              )}

              <button
                onClick={handleCopyInvite}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
              >
                <span>Invite People</span>
                <UserPlus size={14} />
              </button>

              <button
                onClick={() => {
                  toggleTheme()
                  setIsDropdownOpen(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
              >
                <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          )}
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

      {/* Server Settings Modal */}
      <ServerSettingsModal
        isOpen={showServerSettings}
        onClose={() => setShowServerSettings(false)}
      />

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
      />
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

import { ReactNode, useState, useEffect, useRef } from 'react'
import { Bird, Sun, Moon, ChevronDown, Settings, Plus, UserPlus, Sparkles, ShieldCheck } from 'lucide-react'
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
  }, [fetchSettings])

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
    <div className="flex h-full w-full overflow-hidden bg-[#080b11] select-none">
      {/* Primary Channel & Community Navigation Sidebar - 260px */}
      <aside
        className="w-[260px] flex flex-col shrink-0 bg-[#0d121d]/95 border-r border-white/5 relative z-20"
      >
        {/* Community / Server Header with Dropdown */}
        <div
          ref={dropdownRef}
          className="relative h-14 px-3.5 flex items-center justify-between shrink-0 cursor-pointer hover:bg-white/[0.03] transition-colors border-b border-white/5"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {/* Server Logo / Icon */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-[var(--color-brand)] to-cyan-400 p-[1.5px] shrink-0 shadow-md shadow-emerald-500/10">
              <div className="w-full h-full rounded-[10px] bg-[#0e131f] flex items-center justify-center overflow-hidden">
                {serverSettings?.iconUrl ? (
                  <img src={serverSettings.iconUrl} alt="Server" className="w-full h-full object-cover" />
                ) : (
                  <Bird size={18} className="text-emerald-400" />
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-sm text-slate-100 truncate tracking-tight">
                  {serverSettings?.name || 'Roompeak'}
                </h2>
                <span title="Verified Community Server" className="shrink-0 flex items-center">
                  <ShieldCheck size={14} className="text-emerald-400" />
                </span>
              </div>
              <p className="text-[10px] font-medium text-emerald-400/80 flex items-center gap-1 leading-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </p>
            </div>
          </div>

          <ChevronDown
            size={16}
            className={`text-slate-400 shrink-0 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180 text-emerald-400' : ''
            }`}
          />

          {/* Server Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className="absolute top-full left-2 right-2 mt-1.5 p-1.5 rounded-2xl shadow-2xl z-50 animate-fade-in-scale flex flex-col gap-0.5 bg-[#141b2a] border border-white/10 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setShowServerSettings(true)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Settings size={14} />
                      Server Settings
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Admin
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setShowCreateChannel(true)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Plus size={14} className="text-slate-400" />
                      Create Channel
                    </span>
                  </button>

                  <div className="h-px bg-white/5 my-1" />
                </>
              )}

              <button
                onClick={handleCopyInvite}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <UserPlus size={14} className="text-amber-400" />
                  Invite People
                </span>
                <Sparkles size={12} className="text-amber-400" />
              </button>

              <button
                onClick={() => {
                  toggleTheme()
                  setIsDropdownOpen(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun size={14} className="text-amber-300" /> : <Moon size={14} className="text-indigo-300" />}
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Channel List View */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <ChannelList />
        </div>

        {/* Bottom Sidebar with User Profile & Voice Panel */}
        <BottomSidebar />
      </aside>

      {/* Main Chat / Voice Stage Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#080b11] relative overflow-hidden">
        {children}
      </main>

      {/* Member Sidebar on the Right - 240px */}
      <MemberList />

      {/* Modals */}
      <ServerSettingsModal
        isOpen={showServerSettings}
        onClose={() => setShowServerSettings(false)}
      />

      <CreateChannelModal
        isOpen={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
      />
    </div>
  )
}

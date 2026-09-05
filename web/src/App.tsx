import './App.css'
import { Layout } from './components/Layout'
import { LoginForm, RegisterForm } from './components/AuthForms'
import { MessageList } from './components/MessageList'
import { MessageComposer } from './components/MessageComposer'
import { TypingIndicator } from './components/TypingIndicator'
import { ServerConnectionModal } from './components/ServerConnectionModal'
import { useAuthStore } from './stores/authStore'
import { useChannelStore } from './stores/channelStore'
import { useThemeStore } from './stores/themeStore'
import { useWebSocketStore, setTokenGetter } from './stores/websocketStore'
import { useSFU } from './hooks/useSFU'
import { apiFetch, API_BASE_URL, APP_VERSION } from './utils/config'
import { useState, useEffect } from 'react'
import { Sun, Moon, Bird, Server, Settings2 } from 'lucide-react'

type AuthMode = 'login' | 'register'

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  return (
    <button
      onClick={toggleTheme}
      className="absolute top-4 right-4 p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-bg-hover)] active:scale-95"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun size={18} className="text-[var(--color-text-secondary)]" />
      ) : (
        <Moon size={18} className="text-[var(--color-text-secondary)]" />
      )}
    </button>
  )
}

function AuthPage({ mode, onSwitch }: { mode: AuthMode; onSwitch: () => void }) {
  const [urlInviteCode, setUrlInviteCode] = useState('')
  const [showServerModal, setShowServerModal] = useState(false)
  const [serverUrl, setServerUrl] = useState(API_BASE_URL)

  // Listen to server url change
  useEffect(() => {
    const handleUrlChange = (e: any) => {
      if (e.detail?.url) setServerUrl(e.detail.url)
    }
    window.addEventListener('api-base-url-changed', handleUrlChange)
    return () => window.removeEventListener('api-base-url-changed', handleUrlChange)
  }, [])

  // Check URL params for invite code e.g. ?invite=PEAK-XXXX
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('invite') || params.get('code')
      if (code) {
        setUrlInviteCode(code.toUpperCase())
        if (mode !== 'register') {
          onSwitch()
        }
      }
    } catch {
      // Ignore URL parsing failure
    }
  }, [mode, onSwitch])

  const formattedServerDisplay = serverUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0a0d14] p-4 select-none">
      {/* Dynamic Ambient Background Glow Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-sky-500/15 blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <ThemeToggle />

      <div className="w-full max-w-[440px] relative z-10 animate-fade-in-up">
        {/* Branding & Logo */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 via-[var(--color-brand)] to-cyan-400 p-[2px] shadow-xl shadow-emerald-500/20">
              <div className="w-full h-full rounded-[14px] bg-[#0e131f] flex items-center justify-center">
                <Bird size={32} className="text-emerald-400 animate-float" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[9px] font-extrabold text-black uppercase tracking-wider shadow">
              PRO
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Roompeak
          </h1>
          <p className="text-xs font-medium text-slate-400">
            {mode === 'login' ? 'Sign in to access your voice channels & communities' : 'Enter your invite code to join the platform'}
          </p>
        </div>

        {/* Glassmorphic Card */}
        <div className="rounded-3xl p-6 sm:p-8 backdrop-blur-2xl bg-[#111625]/80 border border-white/10 shadow-2xl shadow-black/60 relative overflow-hidden">
          {/* Inner Top Highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 mb-6 rounded-xl bg-white/[0.04] border border-white/5">
            <button
              type="button"
              onClick={() => mode !== 'login' && onSwitch()}
              className={`py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-white shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => mode !== 'register' && onSwitch()}
              className={`py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-white shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form Content */}
          {mode === 'login' ? (
            <LoginForm />
          ) : (
            <RegisterForm initialInviteCode={urlInviteCode} />
          )}
        </div>

        {/* Footer info & Server Switcher */}
        <div className="text-center mt-6 space-y-2.5">
          {/* Server Connection Badge */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowServerModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-slate-300 transition-all cursor-pointer group"
              title="Click to change server or cloudflare tunnel URL"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <Server size={12} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span className="font-mono text-slate-400 group-hover:text-slate-200">{formattedServerDisplay}</span>
              <Settings2 size={12} className="text-slate-500 group-hover:text-slate-300 ml-0.5" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 font-mono text-slate-300">
              v{APP_VERSION}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              End-to-end encrypted voice & real-time chat
            </span>
          </div>
        </div>
      </div>

      <ServerConnectionModal
        isOpen={showServerModal}
        onClose={() => setShowServerModal(false)}
      />
    </div>
  )
}

function ChatPage() {
  // Mount active WebRTC SFU Voice Client
  useSFU()

  const setChannels = useChannelStore((state) => state.setChannels)
  const activeTextChannel = useChannelStore((state) => {
    const id = state.activeChannelId
    const found = state.channels.find((c) => c.id === id)
    if (found && found.type === 'text') return found
    return state.channels.find((c) => c.type === 'text')
  })
  const { theme } = useThemeStore()

  // WebSocket connection
  const token = useAuthStore((state) => state.token)
  const connect = useWebSocketStore((state) => state.connect)
  const isConnected = useWebSocketStore((state) => state.isConnected)

  // Set up token getter for WebSocket store
  useEffect(() => {
    setTokenGetter(() => useAuthStore.getState().token)
  }, [])

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (token && !isConnected) {
      console.log('[App] Connecting WebSocket...')
      connect(token)
    }
  }, [token, isConnected, connect])

  // Fetch and refresh current user profile on mount
  useEffect(() => {
    if (token) {
      apiFetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.status === 401) {
            console.warn('[App] Session expired or invalid (401). Logging out.')
            useAuthStore.getState().logout()
            return null
          }
          return res.ok ? res.json() : null
        })
        .then((data) => {
          if (data) {
            useAuthStore.getState().setUser(data)
          }
        })
        .catch((err) => console.log('[App] /api/users/me fetch error:', err))
    }
  }, [token])

  // Fetch channels on mount
  useEffect(() => {
    apiFetch('/api/channels')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setChannels(data)
          // Auto-select first text channel if none selected
          if (!useChannelStore.getState().activeChannelId) {
            const firstText = data.find((c: any) => c.type === 'text') || data[0]
            useChannelStore.getState().setActiveChannel(firstText.id)
          }
        } else {
          // Fallback demo channels
          setChannels([
            { id: '1', name: 'general', type: 'text', position: 0 },
            { id: '2', name: 'random', type: 'text', position: 1 },
            { id: '3', name: 'announcements', type: 'text', position: 2 },
            { id: '4', name: 'Voice Chat', type: 'voice', position: 3 },
          ])
          if (!useChannelStore.getState().activeChannelId) {
            useChannelStore.getState().setActiveChannel('1')
          }
        }
      })
      .catch(() => {
        // Fallback on error
        setChannels([
          { id: '1', name: 'general', type: 'text', position: 0 },
          { id: '2', name: 'random', type: 'text', position: 1 },
          { id: '3', name: 'announcements', type: 'text', position: 2 },
          { id: '4', name: 'Voice Chat', type: 'voice', position: 3 },
        ])
        if (!useChannelStore.getState().activeChannelId) {
          useChannelStore.getState().setActiveChannel('1')
        }
      })
  }, [setChannels])

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  return (
    <>
      {/* Channel header */}
      <div
        className="h-12 px-4 flex items-center gap-3 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-default)' }}
      >
        <span className="text-lg text-[var(--color-text-secondary)]">#</span>
        <h2 className="font-semibold text-[var(--color-text-primary)]">
          {activeTextChannel?.name || 'general'}
        </h2>
        {activeTextChannel?.topic && (
          <>
            <span className="w-px h-4 bg-[var(--color-border-default)]" />
            <p className="text-sm text-[var(--color-text-muted)] truncate flex-1">
              {activeTextChannel.topic}
            </p>
          </>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors" title="Voice call">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
              <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </button>
          <button className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors" title="Video call">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          <button className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors" title="Pinned messages">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
              <line x1="12" y1="17" x2="12" y2="22"/>
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages and composer */}
      {activeTextChannel ? (
        <>
          <MessageList />
          <TypingIndicator channelId={activeTextChannel.id} />
          <MessageComposer />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
          <Bird size={64} className="mb-4 animate-float opacity-30" />
          <p className="text-xl mb-2">Welcome to PeaceParrot!</p>
          <p className="text-sm">Select a text channel from the sidebar to start chatting</p>
        </div>
      )}
    </>
  )
}

import { ToastContainer } from './components/ToastContainer'
import { UpdateModal } from './components/UpdateModal'

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [authMode, setAuthMode] = useState<AuthMode>('login')

  return (
    <>
      <ToastContainer />
      <UpdateModal />
      {!isAuthenticated ? (
        <AuthPage mode={authMode} onSwitch={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} />
      ) : (
        <Layout>
          <ChatPage />
        </Layout>
      )}
    </>
  )
}

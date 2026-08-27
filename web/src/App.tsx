import './App.css'
import { Layout } from './components/Layout'
import { LoginForm, RegisterForm } from './components/AuthForms'
import { MessageList } from './components/MessageList'
import { MessageComposer } from './components/MessageComposer'
import { TypingIndicator } from './components/TypingIndicator'
import { VoicePanel } from './components/VoicePanel'
import { useAuthStore } from './stores/authStore'
import { useChannelStore } from './stores/channelStore'
import { useThemeStore } from './stores/themeStore'
import { useWebSocketStore, setTokenGetter } from './stores/websocketStore'
import { useState, useEffect } from 'react'
import { Sun, Moon, Bird } from 'lucide-react'

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
  return (
    <div className="h-full flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)' }}>
      <ThemeToggle />

      <div className="w-full max-w-md p-8 animate-fade-in-up">
        {/* Logo & Branding */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-parrot-green)] flex items-center justify-center shadow-lg animate-float">
            <Bird size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">PeaceParrot</h1>
          <p className="text-[var(--color-text-secondary)]">
            {mode === 'login' ? 'Welcome back! Ready to chat?' : 'Join the flock 🦜'}
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl p-8 animate-fade-in-scale" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-default)' }}>
          {mode === 'login' ? (
            <LoginForm onSuccess={() => window.location.reload()} />
          ) : (
            <RegisterForm onSuccess={() => window.location.reload()} />
          )}

          <div className="mt-6 pt-6 text-center" style={{ borderTop: '1px solid var(--color-border-default)' }}>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {mode === 'login' ? (
                <>
                  New to PeaceParrot?{' '}
                  <button type="button" onClick={onSwitch} className="font-medium hover:underline" style={{ color: 'var(--color-brand)' }}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={onSwitch} className="font-medium hover:underline" style={{ color: 'var(--color-brand)' }}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer tagline */}
        <p className="text-center mt-8 text-xs text-[var(--color-text-muted)]">
          ✨ Where conversations feel like home
        </p>
      </div>
    </div>
  )
}

function ChatPage() {
  const setChannels = useChannelStore((state) => state.setChannels)
  const activeChannelId = useChannelStore((state) => state.activeChannelId)
  const activeChannel = useChannelStore((state) => {
    const id = state.activeChannelId
    return state.channels.find(c => c.id === id)
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

  // Fetch channels on mount
  useEffect(() => {
    fetch('http://localhost:8080/api/channels')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setChannels(data)
          // Auto-select first channel if none selected
          if (!useChannelStore.getState().activeChannelId) {
            useChannelStore.getState().setActiveChannel(data[0].id)
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
        <span className={`text-lg ${activeChannel?.type === 'voice' ? 'text-[var(--color-parrot-green)]' : 'text-[var(--color-text-secondary)]'}`}>
          {activeChannel?.type === 'voice' ? '🔊' : '#'}
        </span>
        <h2 className="font-semibold text-[var(--color-text-primary)]">
          {activeChannel?.name || 'general'}
        </h2>
        {activeChannel?.topic && (
          <>
            <span className="w-px h-4 bg-[var(--color-border-default)]" />
            <p className="text-sm text-[var(--color-text-muted)] truncate flex-1">
              {activeChannel.topic}
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

      {/* Messages and composer - only show for text channels */}
      {activeChannelId ? (
        <>
          {activeChannel?.type === 'text' ? (
            <>
              <MessageList />
              <TypingIndicator channelId={activeChannelId} />
              <MessageComposer />
            </>
          ) : activeChannel?.type === 'voice' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
              <Bird size={64} className="mb-4 animate-float opacity-30" />
              <p className="text-xl mb-2">Voice Channel</p>
              <p className="text-sm">Select a text channel to chat</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
          <Bird size={64} className="mb-4 animate-float opacity-30" />
          <p className="text-xl mb-2">Welcome to PeaceParrot!</p>
          <p className="text-sm">Select a channel from the sidebar to start chatting</p>
        </div>
      )}

      {/* Voice Panel - collapsible, shown when in voice */}
      <VoicePanel />
    </>
  )
}

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [authMode, setAuthMode] = useState<AuthMode>('login')

  if (!isAuthenticated) {
    return <AuthPage mode={authMode} onSwitch={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} />
  }

  return (
    <Layout>
      <ChatPage />
    </Layout>
  )
}

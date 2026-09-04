import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { API_BASE_URL } from '../utils/config'
import {
  LogIn,
  UserPlus,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Ticket,
  User,
  Lock,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface AuthFormProps {
  onSuccess?: () => void
  initialInviteCode?: string
}

export function LoginForm({ onSuccess }: AuthFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Invalid username or password')
        return
      }

      login(data.user, data.token)
      onSuccess?.()
    } catch {
      setError('Cannot connect to server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl animate-fade-in bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm shadow-sm"
        >
          <AlertCircle size={18} className="text-rose-400 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Username Field */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Username
        </label>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-[var(--color-text-muted)]">
            <User size={18} />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 transition-all duration-200"
            placeholder="e.g. johndoe"
            required
            autoComplete="username"
            autoFocus
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Password
          </label>
        </div>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-[var(--color-text-muted)]">
            <Lock size={18} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 transition-all duration-200"
            placeholder="••••••••••••"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5 transition-colors"
            tabIndex={-1}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 mt-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[var(--color-brand)] to-emerald-500 hover:from-[var(--color-brand-hover)] hover:to-emerald-400 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-[var(--color-brand)]/25 hover:shadow-[var(--color-brand)]/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <LogIn size={18} />
            <span>Sign In</span>
          </>
        )}
      </button>
    </form>
  )
}

export function RegisterForm({ onSuccess, initialInviteCode = '' }: AuthFormProps) {
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validatingInvite, setValidatingInvite] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')

  const login = useAuthStore((state) => state.login)

  // Live invite code validation with debounce
  useEffect(() => {
    const clean = inviteCode.trim()
    if (!clean) {
      setInviteStatus('idle')
      return
    }

    const timer = setTimeout(async () => {
      setValidatingInvite(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/invites/validate/${encodeURIComponent(clean)}`)
        if (res.ok) {
          setInviteStatus('valid')
        } else {
          setInviteStatus('invalid')
        }
      } catch {
        setInviteStatus('idle')
      } finally {
        setValidatingInvite(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [inviteCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode.trim(),
          username: username.trim(),
          display_name: displayName.trim() || undefined,
          password: password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Registration failed')
        return
      }

      login(data.user, data.token)
      onSuccess?.()
    } catch {
      setError('Cannot connect to server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl animate-fade-in bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm shadow-sm"
        >
          <AlertCircle size={18} className="text-rose-400 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Referral Invite Code Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <Ticket size={13} className="text-amber-400" />
            Invite Code
          </label>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Required
          </span>
        </div>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-amber-400/80">
            <Ticket size={18} />
          </div>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm font-mono tracking-wider bg-white/[0.04] border border-white/10 text-amber-200 placeholder-[var(--color-text-muted)] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all duration-200"
            placeholder="e.g. PEAK-8X9B"
            autoFocus
          />
          <div className="absolute right-3 flex items-center">
            {validatingInvite ? (
              <Loader2 size={16} className="animate-spin text-amber-400" />
            ) : inviteStatus === 'valid' ? (
              <span title="Valid Invite Code">
                <CheckCircle2 size={18} className="text-emerald-400" />
              </span>
            ) : inviteStatus === 'invalid' ? (
              <span title="Invalid or Expired Invite Code">
                <XCircle size={18} className="text-rose-400" />
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
          <Sparkles size={12} className="text-amber-400" />
          First account created is automatically granted Server Admin.
        </p>
      </div>

      {/* Username Field */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Username
        </label>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-[var(--color-text-muted)]">
            <User size={18} />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 transition-all duration-200"
            placeholder="Choose username (3-32 chars)"
            minLength={3}
            maxLength={32}
            required
            autoComplete="username"
          />
        </div>
      </div>

      {/* Display Name Field (Optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Display Name
          </label>
          <span className="text-[10px] text-[var(--color-text-muted)]">Optional</span>
        </div>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 transition-all duration-200"
          placeholder="How others will see you"
          maxLength={64}
        />
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Password
        </label>
        <div className="relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-[var(--color-text-muted)]">
            <Lock size={18} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20 transition-all duration-200"
            placeholder="Min 8 characters"
            minLength={8}
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5 transition-colors"
            tabIndex={-1}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 mt-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-[var(--color-brand)] hover:from-emerald-400 hover:to-[var(--color-brand-hover)] active:scale-[0.99] transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Creating Account...</span>
          </>
        ) : (
          <>
            <UserPlus size={18} />
            <span>Join Roompeak</span>
          </>
        )}
      </button>
    </form>
  )
}

import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { LogIn, UserPlus, Loader2, AlertCircle } from 'lucide-react'

interface AuthFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: AuthFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Login failed')
        return
      }

      login(data.user, data.token)
      onSuccess?.()
    } catch {
      setError('Network error. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg animate-fade-in" style={{ background: 'rgba(237, 100, 100, 0.1)', border: '1px solid rgba(237, 100, 100, 0.3)' }}>
          <AlertCircle size={16} className="text-[var(--color-parrot-red)] shrink-0" />
          <span className="text-sm text-[var(--color-parrot-red)]">{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="input-label">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input"
          placeholder="Enter your username"
          required
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="input-label">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="Enter your password"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full py-2.5 mt-2 transition-all duration-200 hover:shadow-lg disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <LogIn size={18} />
            Sign In
          </>
        )}
      </button>
    </form>
  )
}

export function RegisterForm({ onSuccess }: AuthFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Registration failed')
        return
      }

      login(data.user, data.token)
      onSuccess?.()
    } catch {
      setError('Network error. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg animate-fade-in" style={{ background: 'rgba(237, 100, 100, 0.1)', border: '1px solid rgba(237, 100, 100, 0.3)' }}>
          <AlertCircle size={16} className="text-[var(--color-parrot-red)] shrink-0" />
          <span className="text-sm text-[var(--color-parrot-red)]">{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="input-label">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input"
          placeholder="Choose a username (3-32 chars)"
          minLength={3}
          maxLength={32}
          required
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="input-label">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="Create a password (min 8 chars)"
          minLength={8}
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-success w-full py-2.5 mt-2 transition-all duration-200 hover:shadow-lg disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Creating account...
          </>
        ) : (
          <>
            <UserPlus size={18} />
            Create Account
          </>
        )}
      </button>
    </form>
  )
}

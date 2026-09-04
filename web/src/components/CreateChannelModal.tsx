import { useState } from 'react'
import { Hash, Volume2, X, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useChannelStore } from '../stores/channelStore'
import { API_BASE_URL } from '../utils/config'

interface CreateChannelModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: 'text' | 'voice'
}

export function CreateChannelModal({ isOpen, onClose, initialType = 'text' }: CreateChannelModalProps) {
  const [type, setType] = useState<'text' | 'voice'>(initialType)
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = useAuthStore((state) => state.token)
  const setActiveChannel = useChannelStore((state) => state.setActiveChannel)

  if (!isOpen) return null

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    if (type === 'text') {
      val = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')
    }
    setName(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a channel name')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          topic: topic.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to create channel')
        setLoading(false)
        return
      }

      const newChannel = await res.json()

      // Refresh channels from API
      const resList = await fetch(`${API_BASE_URL}/api/channels`)
      if (resList.ok) {
        const list = await resList.json()
        if (Array.isArray(list)) useChannelStore.getState().setChannels(list)
      }

      if (type === 'text') {
        setActiveChannel(newChannel.id)
      }

      setName('')
      setTopic('')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-5 animate-fade-in-scale"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Create Channel</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Channel Type Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Channel Type
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setType('text')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                  type === 'text'
                    ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)] text-[var(--color-text-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    type === 'text' ? 'bg-[var(--color-brand)] text-white' : 'bg-black/20 text-[var(--color-text-muted)]'
                  }`}
                >
                  <Hash size={20} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Text Channel</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Post messages, images, stickers, and opinions
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('voice')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                  type === 'voice'
                    ? 'bg-[var(--color-brand)]/10 border-[var(--color-brand)] text-[var(--color-text-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    type === 'voice' ? 'bg-[var(--color-brand)] text-white' : 'bg-black/20 text-[var(--color-text-muted)]'
                  }`}
                >
                  <Volume2 size={20} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Voice Channel</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Hang out together with crystal-clear voice and screen share
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Channel Name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
              Channel Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[var(--color-text-muted)]">
                {type === 'text' ? '#' : '🔊'}
              </span>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder={type === 'text' ? 'new-channel' : 'General Voice'}
                maxLength={40}
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] focus:outline-none focus:border-[var(--color-brand)] text-sm font-medium"
              />
            </div>
          </div>

          {/* Channel Topic */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
              Channel Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel about?"
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--color-brand)] hover:opacity-90 text-white transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

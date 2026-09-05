import { useState, useEffect } from 'react'
import { Server, Globe, Check, AlertCircle, Loader2, X, RotateCcw, ArrowRight } from 'lucide-react'
import {
  API_BASE_URL,
  DEFAULT_LOCAL_URL,
  setApiBaseUrl,
} from '../utils/config'

interface ServerConnectionModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ServerConnectionModal({ isOpen, onClose }: ServerConnectionModalProps) {
  const [currentUrl, setCurrentUrl] = useState(API_BASE_URL)
  const [inputUrl, setInputUrl] = useState(API_BASE_URL)
  const [isTesting, setIsTesting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    setCurrentUrl(API_BASE_URL)
    setInputUrl(API_BASE_URL)
  }, [isOpen])

  // Listen to global changes
  useEffect(() => {
    const handleUrlChange = (e: any) => {
      if (e.detail?.url) {
        setCurrentUrl(e.detail.url)
      }
    }
    window.addEventListener('api-base-url-changed', handleUrlChange)
    return () => window.removeEventListener('api-base-url-changed', handleUrlChange)
  }, [])

  if (!isOpen) return null

  const handleTestAndSave = async (urlToTest: string) => {
    const cleanUrl = urlToTest.trim().replace(/\/+$/, '')
    if (!cleanUrl) return

    setIsTesting(true)
    setStatus('idle')
    setStatusMessage('')

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)

      const res = await fetch(`${cleanUrl}/health`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        setApiBaseUrl(cleanUrl, true)
        setCurrentUrl(cleanUrl)
        setStatus('success')
        setStatusMessage('Connected successfully to backend server!')
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setStatus('error')
        setStatusMessage(`Server responded with HTTP ${res.status}. Health check failed.`)
      }
    } catch (err: any) {
      setStatus('error')
      setStatusMessage('Cannot connect to this URL. Make sure the backend or Cloudflare tunnel is running.')
    } finally {
      setIsTesting(false)
    }
  }

  const handleResetToLocalhost = () => {
    setInputUrl(DEFAULT_LOCAL_URL)
    handleTestAndSave(DEFAULT_LOCAL_URL)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#111625] border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 relative animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Server Connection</h3>
              <p className="text-[11px] text-slate-400">Configure backend endpoint or tunnel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Active Indicator */}
        <div className="mb-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active Endpoint</span>
            <p className="text-xs font-mono font-medium text-emerald-300 truncate max-w-[240px]">
              {currentUrl}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </div>
        </div>

        {/* URL Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleTestAndSave(inputUrl)
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Globe size={13} className="text-sky-400" />
              Custom Server / Cloudflare Tunnel URL
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://xxxx.trycloudflare.com or http://localhost:8080"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            <p className="text-[11px] text-slate-400">
              Paste your TryCloudflare link here when testing with friends.
            </p>
          </div>

          {/* Status feedback */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                status === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              {status === 'success' ? (
                <Check size={16} className="shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Smart Fallback Feature Note */}
          <div className="p-3 rounded-2xl bg-sky-500/5 border border-sky-500/15 text-[11px] text-sky-300 leading-relaxed">
            <span className="font-bold text-sky-200">✨ Automatic Fallback:</span> If your Cloudflare tunnel goes offline, Roompeak will automatically fall back to <code className="bg-sky-950 px-1 py-0.5 rounded text-sky-200">localhost:8080</code> so you won't encounter connection errors.
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleResetToLocalhost}
              disabled={isTesting}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={14} />
              Reset Localhost
            </button>
            <button
              type="submit"
              disabled={isTesting || !inputUrl.trim()}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <span>Save & Connect</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

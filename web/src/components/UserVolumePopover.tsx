import { useState, useEffect, useRef } from 'react'
import { VolumeX, MicOff, RotateCcw, X, Sliders } from 'lucide-react'
import {
  useVoiceStore,
  getSavedUserVolume,
  getSavedUserLocalMute,
} from '../stores/voiceStore'

interface UserVolumePopoverProps {
  userId: string
  displayName: string
  username?: string
  avatarUrl?: string
  isOpen: boolean
  onClose: () => void
  anchorPosition?: { x: number; y: number } | null
}

export function UserVolumePopover({
  userId,
  displayName,
  username,
  avatarUrl,
  isOpen,
  onClose,
  anchorPosition,
}: UserVolumePopoverProps) {
  const setUserVolume = useVoiceStore((state) => state.setUserVolume)
  const setUserLocalMute = useVoiceStore((state) => state.setUserLocalMute)

  const [volumePercent, setVolumePercent] = useState<number>(() => {
    return Math.round(getSavedUserVolume(userId) * 100)
  })
  const [isLocalMuted, setIsLocalMuted] = useState<boolean>(() => {
    return getSavedUserLocalMute(userId)
  })

  const popoverRef = useRef<HTMLDivElement>(null)

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setVolumePercent(Math.round(getSavedUserVolume(userId) * 100))
      setIsLocalMuted(getSavedUserLocalMute(userId))
    }
  }, [isOpen, userId])

  // Close on click outside or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleVolumeChange = (newPercent: number) => {
    const clamped = Math.max(0, Math.min(200, Math.round(newPercent)))
    setVolumePercent(clamped)
    setUserVolume(userId, clamped / 100)
    if (clamped > 0 && isLocalMuted) {
      setIsLocalMuted(false)
      setUserLocalMute(userId, false)
    }
  }

  const handleToggleLocalMute = () => {
    const nextMute = !isLocalMuted
    setIsLocalMuted(nextMute)
    setUserLocalMute(userId, nextMute)
  }

  const handleReset = () => {
    setVolumePercent(100)
    setIsLocalMuted(false)
    setUserVolume(userId, 1.0)
    setUserLocalMute(userId, false)
  }

  // Calculate position styles
  const popoverStyle: React.CSSProperties = anchorPosition
    ? {
        position: 'fixed',
        left: `${Math.min(window.innerWidth - 280, Math.max(10, anchorPosition.x))}px`,
        top: `${Math.min(window.innerHeight - 260, Math.max(10, anchorPosition.y))}px`,
        zIndex: 9999,
      }
    : {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
      }

  const isBoosted = volumePercent > 100

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="w-[260px] bg-[#111625] border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/80 select-none animate-fade-in-scale"
    >
      {/* Header with User Info */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              (displayName || 'U')[0].toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate leading-tight">{displayName}</h4>
            {username && <p className="text-[10px] text-slate-400 truncate">@{username}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Volume Control Section */}
      <div className="py-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Sliders size={12} className="text-emerald-400" />
            User Volume
          </label>
          <span
            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
              isLocalMuted || volumePercent === 0
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                : isBoosted
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
            }`}
          >
            {isLocalMuted ? 'Muted' : `${volumePercent}%`}
          </span>
        </div>

        {/* Volume Slider (0 - 200%) */}
        <div className="space-y-1">
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={isLocalMuted ? 0 : volumePercent}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-emerald-400"
              style={{
                background: `linear-gradient(to right, ${
                  isBoosted ? '#f59e0b' : '#10b981'
                } 0%, ${isBoosted ? '#f59e0b' : '#10b981'} ${
                  (isLocalMuted ? 0 : volumePercent) / 2
                }%, #1e293b ${(isLocalMuted ? 0 : volumePercent) / 2}%, #1e293b 100%)`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-0.5">
            <span>0%</span>
            <span className="text-slate-400">100% (Normal)</span>
            <span className="text-amber-400/80">200% (Boost)</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-white/5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleLocalMute}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isLocalMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
              : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10 hover:text-white'
          }`}
        >
          {isLocalMuted ? <VolumeX size={13} /> : <MicOff size={13} />}
          <span>{isLocalMuted ? 'Unmute' : 'Mute for Me'}</span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          title="Reset volume to 100%"
          className="p-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-white/5 transition-all cursor-pointer"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  )
}

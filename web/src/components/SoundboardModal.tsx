import { useState, useRef, useEffect } from 'react'
import {
  Volume2,
  VolumeX,
  Sparkles,
  Play,
  Plus,
  Trash2,
  Search,
  Flame,
  Gamepad2,
  Star,
} from 'lucide-react'
import {
  DEFAULT_SOUNDBOARD,
  SoundboardItem,
  playSoundboardEffect,
} from '../utils/soundboardAudio'
import { apiFetch } from '../utils/config'
import { useWebSocketStore } from '../stores/websocketStore'
import { useVoiceStore } from '../stores/voiceStore'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { toast } from '../stores/toastStore'
import { SoundUploadModal } from './SoundUploadModal'

interface SoundboardModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SoundboardModal({ isOpen, onClose }: SoundboardModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const soundboardVolume = useSettingsStore((s) => s.soundboardVolume ?? 80)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [customSounds, setCustomSounds] = useState<SoundboardItem[]>(() => {
    try {
      const saved = localStorage.getItem('peaceparrot_custom_sounds')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [playingId, setPlayingId] = useState<string | null>(null)

  const popoutRef = useRef<HTMLDivElement>(null)
  const send = useWebSocketStore((s) => s.send)
  const currentVoiceRoom = useVoiceStore((s) => s.channelId)

  // Fetch server soundboard items and listen to real-time events
  useEffect(() => {
    const fetchSounds = async () => {
      try {
        const res = await apiFetch('/api/soundboard')
        if (res.ok) {
          const items: SoundboardItem[] = await res.json()
          if (Array.isArray(items)) {
            setCustomSounds(items)
            localStorage.setItem('peaceparrot_custom_sounds', JSON.stringify(items))
          }
        }
      } catch (err) {
        console.warn('Failed to fetch server soundboard items:', err)
      }
    }
    fetchSounds()

    const unsubscribe = useWebSocketStore.getState().subscribe((msg) => {
      if (msg.type === 'soundboard_item_add') {
        const item = msg.payload as unknown as SoundboardItem
        if (item && item.id) {
          setCustomSounds((prev) => {
            if (prev.some((s) => s.id === item.id)) return prev
            const updated = [...prev, item]
            localStorage.setItem('peaceparrot_custom_sounds', JSON.stringify(updated))
            return updated
          })
        }
      } else if (msg.type === 'soundboard_item_delete') {
        const { id } = (msg.payload || {}) as { id?: string }
        if (id) {
          setCustomSounds((prev) => {
            const updated = prev.filter((s) => s.id !== id)
            localStorage.setItem('peaceparrot_custom_sounds', JSON.stringify(updated))
            return updated
          })
        }
      }
    })

    return unsubscribe
  }, [])

  // Click outside / Outfocus to close popout
  useEffect(() => {
    const handleMouseDownOutside = (e: MouseEvent) => {
      // If upload modal is open, don't close the soundboard popout
      if (isUploadModalOpen) return

      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUploadModalOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleMouseDownOutside)
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleMouseDownOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isUploadModalOpen, onClose])

  if (!isOpen) return null

  const handleVolumeChange = (newVolPercent: number) => {
    updateSettings({
      soundboardVolume: Math.max(0, Math.min(100, Math.round(newVolPercent))),
    })
  }

  const allSounds = [...DEFAULT_SOUNDBOARD, ...customSounds]
  const filteredSounds = allSounds.filter((s) => {
    const matchesCategory =
      activeCategory === 'all' || s.category === activeCategory
    const matchesSearch =
      !searchQuery.trim() ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    return matchesCategory && matchesSearch
  })

  const handlePlaySound = (sound: SoundboardItem) => {
    // If soundboard is muted at 0%, do not play sound, do not light indicator, and do not broadcast
    if (soundboardVolume <= 0) {
      toast.warning('Soundboard is muted (0% volume). Unmute to play sounds.')
      return
    }

    setPlayingId(sound.id)
    playSoundboardEffect(sound.id, sound.customUrl)

    // Trigger green speaking indicator on avatar while sound plays
    const myId = useAuthStore.getState().user?.id
    useVoiceStore.getState().setParticipantSpeaking('local', true)
    if (myId) {
      useVoiceStore.getState().setParticipantSpeaking(myId, true)
    }

    setTimeout(() => {
      useVoiceStore.getState().setParticipantSpeaking('local', false)
      if (myId) {
        useVoiceStore.getState().setParticipantSpeaking(myId, false)
      }
    }, 1800)

    // Broadcast over WebSocket if in voice channel
    send({
      type: 'soundboard_play',
      channelId: currentVoiceRoom || undefined,
      payload: {
        soundId: sound.id,
        soundName: sound.name,
        soundUrl: sound.customUrl,
        channelId: currentVoiceRoom,
        senderUserId: myId,
      },
    })

    setTimeout(() => {
      setPlayingId(null)
    }, 1200)
  }

  const handleSoundAdded = (newSound: SoundboardItem) => {
    setCustomSounds((prev) => {
      if (prev.some((s) => s.id === newSound.id)) return prev
      const updated = [...prev, newSound]
      localStorage.setItem('peaceparrot_custom_sounds', JSON.stringify(updated))
      return updated
    })
  }

  const handleDeleteCustomSound = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customSounds.filter((s) => s.id !== id)
    setCustomSounds(updated)
    localStorage.setItem('peaceparrot_custom_sounds', JSON.stringify(updated))

    const token = localStorage.getItem('token') || ''
    try {
      await apiFetch(`/api/soundboard/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch (err) {
      console.warn('Failed to delete soundboard item on backend:', err)
    }
    toast.success('Sound clip removed.')
  }

  return (
    <>
      {/* Non-blocking Discord-Style Popout Container */}
      <div
        ref={popoutRef}
        className="fixed bottom-[135px] left-[76px] z-[9990] w-[460px] max-w-[calc(100vw-90px)] h-[460px] bg-[#2b2d31] border border-[#1e1f22] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col animate-fade-in-scale select-none"
      >
        {/* Top Header & Search Bar Row */}
        <div className="p-3 border-b border-[#1f2023] bg-[#2b2d31] flex items-center gap-2.5">
          {/* Search Bar */}
          <div className="flex-1 relative flex items-center bg-[#1e1f22] rounded-lg px-2.5 py-1.5 border border-[#1e1f22] focus-within:border-[#5865f2] transition-colors">
            <Search size={15} className="text-gray-400 shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find the perfect sound"
              className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#1e1f22] border border-[#1e1f22] shrink-0">
            <button
              type="button"
              onClick={() => handleVolumeChange(soundboardVolume > 0 ? 0 : 80)}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              title={soundboardVolume > 0 ? 'Mute Soundboard' : 'Unmute Soundboard'}
            >
              {soundboardVolume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} className="text-red-400" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={soundboardVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-16 h-1.5 bg-gray-600 rounded appearance-none cursor-pointer accent-[#5865f2]"
              title="Soundboard Volume"
            />
            <span className="text-[10px] font-mono text-gray-400 w-7 text-right">
              {Math.round(soundboardVolume)}%
            </span>
          </div>
        </div>

        {/* Main Body: Left Category Strip + Right Sound Grid */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Category Icon Strip (Discord style) */}
          <div className="w-12 bg-[#1e1f22] border-r border-[#1f2023] flex flex-col items-center py-2 gap-1.5 shrink-0 overflow-y-auto">
            {[
              { id: 'all', title: 'All Sounds', icon: Sparkles },
              { id: 'memes', title: 'Memes', icon: Flame },
              { id: 'game', title: 'Gaming', icon: Gamepad2 },
              { id: 'custom', title: 'Custom Sounds', icon: Star },
            ].map((cat) => {
              const Icon = cat.icon
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
                    isActive
                      ? 'bg-[#5865f2] text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-[#2b2d31]'
                  }`}
                  title={cat.title}
                >
                  <Icon size={16} />
                  {/* Left active indicator pill */}
                  {isActive && (
                    <div className="absolute -left-1 w-1 h-4 bg-white rounded-r-full" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Right Soundboard Cards Grid */}
          <div className="flex-1 overflow-y-auto p-3.5 bg-[#2b2d31]">
            <div className="grid grid-cols-2 gap-2">
              {filteredSounds.map((sound) => {
                const isPlaying = playingId === sound.id
                return (
                  <div
                    key={sound.id}
                    onClick={() => handlePlaySound(sound)}
                    className={`group relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                      isPlaying
                        ? 'bg-[#5865f2]/25 border-[#5865f2] scale-[0.98]'
                        : 'bg-[#1e1f22] border-[#1e1f22] hover:border-[#3b3e45] hover:bg-[#35373c]'
                    }`}
                  >
                    {/* Delete button for custom sounds */}
                    {sound.category === 'custom' && (
                      <button
                        onClick={(e) => handleDeleteCustomSound(sound.id, e)}
                        className="absolute top-1.5 right-1.5 p-1 rounded text-gray-400 hover:text-red-400 hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Delete sound"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    {/* Emoji / Play Icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 transition-transform ${
                        isPlaying
                          ? 'scale-110 bg-[#5865f2]/40 animate-pulse'
                          : 'group-hover:scale-105 bg-[#2b2d31]'
                      }`}
                    >
                      {isPlaying ? (
                        <Play size={14} className="text-[#5865f2] fill-current" />
                      ) : (
                        sound.emoji
                      )}
                    </div>

                    {/* Title & Duration */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="text-xs font-semibold text-white truncate leading-snug">
                        {sound.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono leading-none mt-0.5">
                        {sound.duration || 'SFX'}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Add Custom Sound Card */}
              <div
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-[#3b3e45] hover:border-[#5865f2] bg-[#1e1f22]/60 hover:bg-[#5865f2]/10 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 group-hover:text-[#5865f2] bg-[#2b2d31] group-hover:scale-105 transition-transform shrink-0">
                  <Plus size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-gray-200 group-hover:text-white truncate">
                    Add Sound
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    Cut & upload
                  </div>
                </div>
              </div>
            </div>

            {filteredSounds.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 text-gray-400">
                <Search size={28} className="mb-2 opacity-30" />
                <p className="text-xs font-medium">No sounds found</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Hint */}
        <div className="px-3 py-2 bg-[#1e1f22] border-t border-[#1f2023] flex items-center justify-between text-[11px] text-gray-400">
          <span className="truncate">
            {currentVoiceRoom ? '🔊 Broadcasting in voice' : 'Click to preview sounds'}
          </span>
          <span className="text-gray-500 font-mono text-[10px]">
            {allSounds.length} sounds
          </span>
        </div>
      </div>

      {/* Discord-Style Sound Upload & Audio Trimmer Modal */}
      <SoundUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSoundAdded={handleSoundAdded}
      />
    </>
  )
}

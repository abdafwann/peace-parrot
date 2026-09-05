import { useState, useEffect } from 'react'
import {
  Radio,
  Activity,
  PhoneOff,
  Video,
  VideoOff,
  ScreenShare,
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Settings,
  Volume2,
  Music,
} from 'lucide-react'
import { useVoiceStore } from '../stores/voiceStore'
import { useChannelStore } from '../stores/channelStore'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useWebSocketStore } from '../stores/websocketStore'
import { useVoiceCleanup } from '../hooks/useVoice'
import { UserSettingsModal } from './UserSettingsModal'
import { SoundboardModal } from './SoundboardModal'
import { playSoundEffect } from '../utils/soundEffects'
import { playSoundboardEffect } from '../utils/soundboardAudio'
import { toast } from '../stores/toastStore'
import { APP_VERSION } from '../utils/config'

export function BottomSidebar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false)
  const isInVoice = useVoiceStore((state) => state.channelId !== null)
  const voiceChannelId = useVoiceStore((state) => state.channelId)
  const selfMuted = useVoiceStore((state) => state.selfMuted)
  const selfDeafened = useVoiceStore((state) => state.selfDeafened)
  const isScreenSharing = useVoiceStore((state) => state.isScreenSharing)
  const setSelfMuted = useVoiceStore((state) => state.setSelfMuted)
  const setSelfDeafened = useVoiceStore((state) => state.setSelfDeafened)
  const setIsScreenSharing = useVoiceStore((state) => state.setIsScreenSharing)

  const [isVideoOn, setIsVideoOn] = useState(false)
  const { leaveChannel } = useVoiceCleanup()

  const user = useAuthStore((state) => state.user)
  const channels = useChannelStore((state) => state.channels)
  const voiceChannel = channels.find((c) => c.id === voiceChannelId)

  // Listen for real-time soundboard events across voice channels
  useEffect(() => {
    const unsubscribe = useWebSocketStore.getState().subscribe((msg) => {
      if (msg.type === 'soundboard_play') {
        const payload = (msg.payload || {}) as {
          soundId?: string
          soundName?: string
          soundUrl?: string
          channelId?: string
          username?: string
          userId?: string
        }
        if (payload.soundId) {
          const currentUserId = useAuthStore.getState().user?.id
          const senderId = payload.userId || ''
          const isSelf = Boolean(payload.userId && payload.userId === currentUserId)
          const soundboardVol = useSettingsStore.getState().soundboardVolume ?? 80

          const currentVoiceChannel = useVoiceStore.getState().channelId
          const inSameChannel = !payload.channelId || (currentVoiceChannel && currentVoiceChannel === payload.channelId)

          if (!isSelf && soundboardVol > 0 && inSameChannel) {
            playSoundboardEffect(payload.soundId, payload.soundUrl)
            toast.info(
              `played "${payload.soundName || payload.soundId}"`,
              `🔊 ${payload.username || 'Someone'}`
            )
          }

          if (senderId) {
            useVoiceStore.getState().setParticipantSpeaking(senderId, true)
            if (isSelf) {
              useVoiceStore.getState().setParticipantSpeaking('local', true)
            }

            setTimeout(() => {
              useVoiceStore.getState().setParticipantSpeaking(senderId, false)
              if (isSelf) {
                useVoiceStore.getState().setParticipantSpeaking('local', false)
              }
            }, 1800)
          }
        }
      }
    })
    return unsubscribe
  }, [])

  const handleToggleMute = () => {
    const nextMuted = !selfMuted
    setSelfMuted(nextMuted)
    playSoundEffect(nextMuted ? 'mute' : 'unmute')

    if (voiceChannelId) {
      useWebSocketStore.getState().send({
        type: 'voice_state_update',
        channelId: voiceChannelId,
        payload: {
          channelId: voiceChannelId,
          selfMuted: nextMuted,
          selfDeafened,
        },
      })
    }
  }

  const handleToggleDeafen = () => {
    const nextDeafened = !selfDeafened
    setSelfDeafened(nextDeafened)
    playSoundEffect(nextDeafened ? 'mute' : 'unmute')

    if (voiceChannelId) {
      useWebSocketStore.getState().send({
        type: 'voice_state_update',
        channelId: voiceChannelId,
        payload: {
          channelId: voiceChannelId,
          selfMuted,
          selfDeafened: nextDeafened,
        },
      })
    }
  }

  return (
    <div className="shrink-0 flex flex-col bg-[#0a0e17] border-t border-white/5 select-none">
      {/* Voice Connected Panel (when user is in a voice channel) */}
      {isInVoice && (
        <div className="p-2.5 flex flex-col gap-2 animate-fade-in bg-emerald-950/20 border-b border-emerald-500/20">
          {/* Header Row: Voice Connected & Disconnect */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-400">
                <Radio size={15} className="animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-emerald-400 leading-tight">
                  Voice Connected
                </div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5 leading-none">
                  <span className="truncate">{voiceChannel?.name || 'Voice Channel'}</span>
                </div>
              </div>
            </div>

            {/* RTC Signal & Disconnect button */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="p-1 text-emerald-400" title="WebRTC SFU Connected (Low Latency)">
                <Activity size={15} />
              </div>
              <button
                onClick={leaveChannel}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-all active:scale-95 cursor-pointer"
                title="Disconnect from Voice"
              >
                <PhoneOff size={15} />
              </button>
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`h-7 rounded-lg flex items-center justify-center text-xs font-medium gap-1.5 transition-all active:scale-95 cursor-pointer ${
                isVideoOn
                  ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300'
              }`}
              title={isVideoOn ? 'Turn off Camera' : 'Turn on Camera'}
            >
              {isVideoOn ? <Video size={14} /> : <VideoOff size={14} />}
              <span>Video</span>
            </button>

            <button
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              className={`h-7 rounded-lg flex items-center justify-center text-xs font-medium gap-1.5 transition-all active:scale-95 cursor-pointer ${
                isScreenSharing
                  ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300'
              }`}
              title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
            >
              <ScreenShare size={14} />
              <span>Share</span>
            </button>

            <button
              onClick={() => setIsSoundboardOpen(true)}
              className="h-7 rounded-lg flex items-center justify-center text-xs font-medium gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-amber-300 transition-all active:scale-95 cursor-pointer"
              title="Open Soundboard"
            >
              <Music size={14} className="text-amber-400" />
              <span>SFX</span>
            </button>
          </div>
        </div>
      )}

      {/* User Profile & Audio Controls Bar */}
      <div className="h-14 px-2.5 flex items-center justify-between gap-1.5 shrink-0">
        {/* User Info */}
        <div
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2.5 min-w-0 flex-1 p-1 rounded-xl hover:bg-white/[0.04] cursor-pointer transition-colors group"
          title="Open User Settings"
        >
          {/* Avatar with Status indicator */}
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm transition-transform group-hover:scale-105 overflow-hidden ring-1 ring-white/10"
              style={{
                background: user?.avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--color-brand), #0ea5e9)',
              }}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (user?.displayName || user?.username || 'U')[0].toUpperCase()
              )}
            </div>
            {/* Online Status Dot */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#0a0e17] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* User Details */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-100 truncate leading-tight group-hover:text-emerald-300 transition-colors">
              {user?.displayName || user?.username || 'User'}
            </p>
            {isInVoice ? (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium leading-none mt-0.5">
                <Volume2 size={10} className="shrink-0 animate-pulse" />
                <span>In Voice</span>
              </p>
            ) : (
              <p className="text-[10px] text-slate-400 truncate leading-none mt-0.5">
                @{user?.username || 'username'}
              </p>
            )}
          </div>
        </div>

        {/* Audio Toggles & Settings Gear */}
        <div className="flex items-center gap-0.5 shrink-0 text-slate-400">
          <button
            onClick={handleToggleMute}
            className={`p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
              selfMuted
                ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25'
                : 'hover:text-slate-100 hover:bg-white/[0.06]'
            }`}
            title={selfMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {selfMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            onClick={handleToggleDeafen}
            className={`p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
              selfDeafened
                ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25'
                : 'hover:text-slate-100 hover:bg-white/[0.06]'
            }`}
            title={selfDeafened ? 'Undeafen Headphones' : 'Deafen Headphones'}
          >
            {selfDeafened ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl hover:text-slate-100 hover:bg-white/[0.06] transition-all group active:scale-95 cursor-pointer"
            title={`User Settings (v${APP_VERSION})`}
          >
            <Settings size={16} className="group-hover:rotate-45 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <SoundboardModal
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
      />
    </div>
  )
}

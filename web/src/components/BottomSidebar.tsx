import { useState } from 'react'
import {
  Radio,
  Activity,
  PhoneOff,
  Video,
  VideoOff,
  ScreenShare,
  Gamepad2,
  Megaphone,
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Settings,
  ChevronDown,
  Volume2,
  Moon,
} from 'lucide-react'
import { useVoiceStore } from '../stores/voiceStore'
import { useChannelStore } from '../stores/channelStore'
import { useAuthStore } from '../stores/authStore'
import { useWebSocketStore } from '../stores/websocketStore'
import { useVoiceCleanup } from '../hooks/useVoice'

export function BottomSidebar() {
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

  const handleToggleMute = () => {
    const nextMuted = !selfMuted
    setSelfMuted(nextMuted)

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
    <div
      className="shrink-0 flex flex-col"
      style={{
        background: 'var(--color-bg-tertiary)',
        borderTop: '1px solid var(--color-border-default)',
      }}
    >
      {/* Voice Connected Widget (only rendered when connected to a voice channel) */}
      {isInVoice && (
        <div
          className="p-2 flex flex-col gap-2 animate-fade-in"
          style={{
            borderBottom: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-secondary)',
          }}
        >
          {/* Header Row: Voice Connected & Disconnect */}
          <div className="flex items-center justify-between gap-1 px-1">
            {/* Left: Signal Icon & Channel Info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(35, 165, 89, 0.15)', color: '#23a559' }}
              >
                <Radio size={15} className="animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#23a559] leading-none hover:underline cursor-pointer">
                  Voice Connected
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)] truncate flex items-center gap-1 mt-1 leading-none">
                  <span className="text-[10px] shrink-0">🔊</span>
                  <span className="truncate">
                    {voiceChannel?.name || 'Voice Chat'} / PeaceParrot
                  </span>
                </div>
              </div>
            </div>

            {/* Right: RTC & Disconnect button */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[#23a559] transition-colors"
                title="RTC Connected / 18ms (PeaceParrot WebRTC)"
              >
                <Activity size={16} className="text-[#23a559]" />
              </button>
              <button
                onClick={leaveChannel}
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[#ed4245] hover:bg-[#ed4245]/15 transition-all active:scale-95"
                title="Disconnect"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>

          {/* Quick Action Buttons Row (Camera, Screen Share, Activities, Soundboard) */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            {/* 1. Camera button */}
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95 ${
                isVideoOn
                  ? 'bg-[#23a559] text-white shadow-sm'
                  : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-white'
              }`}
              title={isVideoOn ? 'Turn off Camera' : 'Turn on Camera'}
            >
              {isVideoOn ? <Video size={17} /> : <VideoOff size={17} />}
            </button>

            {/* 2. Screen Share button */}
            <button
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              className={`h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95 ${
                isScreenSharing
                  ? 'bg-[#23a559] text-white shadow-sm'
                  : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-white'
              }`}
              title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Your Screen'}
            >
              <ScreenShare size={17} />
            </button>

            {/* 3. Activities / Apps button */}
            <button
              className="h-8 rounded-lg flex items-center justify-center bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-white transition-all duration-150 active:scale-95"
              title="Start Activity"
            >
              <Gamepad2 size={17} />
            </button>

            {/* 4. Soundboard / Spotlight button */}
            <button
              className="h-8 rounded-lg flex items-center justify-center bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-white transition-all duration-150 active:scale-95"
              title="Open Soundboard"
            >
              <Megaphone size={17} />
            </button>
          </div>
        </div>
      )}

      {/* User Profile Bar (Always visible at bottom) */}
      <div className="h-[52px] px-2 flex items-center justify-between gap-1 shrink-0">
        {/* Left: User Avatar & Name */}
        <div className="flex items-center gap-2 min-w-0 flex-1 px-1 py-1 rounded-md hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors">
          {/* Avatar with Status badge */}
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))',
              }}
            >
              {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
            </div>
            {/* Status dot / moon indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
              {isInVoice ? (
                <div className="w-2.5 h-2.5 rounded-full bg-[#23a559]" />
              ) : (
                <Moon size={9} className="text-[#f0b232] fill-[#f0b232]" />
              )}
            </div>
          </div>

          {/* Username & Status */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
              {user?.displayName || user?.username || 'Username'}
            </p>
            {isInVoice ? (
              <p className="text-[11px] text-[#23a559] flex items-center gap-1 font-medium leading-none mt-0.5">
                <Volume2 size={11} className="shrink-0 animate-pulse" />
                <span>In voice</span>
              </p>
            ) : (
              <p className="text-[11px] text-[var(--color-text-muted)] truncate leading-none mt-0.5">
                Online
              </p>
            )}
          </div>
        </div>

        {/* Right: Quick User Controls (Mic, Headset, Settings) */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Mute toggle button with dropdown arrow */}
          <div className="flex items-center">
            <button
              onClick={handleToggleMute}
              className={`p-1.5 rounded-md transition-colors ${
                selfMuted
                  ? 'text-[#ed4245] hover:bg-[#ed4245]/15'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]'
              }`}
              title={selfMuted ? 'Unmute' : 'Mute'}
            >
              {selfMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <ChevronDown size={10} className="text-[var(--color-text-muted)] -ml-0.5 cursor-pointer opacity-70 hover:opacity-100" />
          </div>

          {/* Deafen toggle button with dropdown arrow */}
          <div className="flex items-center">
            <button
              onClick={handleToggleDeafen}
              className={`p-1.5 rounded-md transition-colors ${
                selfDeafened
                  ? 'text-[#ed4245] hover:bg-[#ed4245]/15'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]'
              }`}
              title={selfDeafened ? 'Undeafen' : 'Deafen'}
            >
              {selfDeafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
            </button>
            <ChevronDown size={10} className="text-[var(--color-text-muted)] -ml-0.5 cursor-pointer opacity-70 hover:opacity-100" />
          </div>

          {/* Settings button */}
          <button
            className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-colors group"
            title="User Settings"
          >
            <Settings
              size={18}
              className="group-hover:rotate-45 transition-transform duration-300"
            />
          </button>
        </div>
      </div>
    </div>
  )
}

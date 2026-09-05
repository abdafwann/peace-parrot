import { useState } from 'react'
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  PhoneOff,
  Monitor,
  ChevronUp,
  ChevronDown,
  Sliders,
  VolumeX,
} from 'lucide-react'
import {
  useVoiceStore,
  getSavedUserVolume,
  getSavedUserLocalMute,
} from '../stores/voiceStore'
import { useVoiceCleanup } from '../hooks/useVoice'
import { useChannelStore } from '../stores/channelStore'
import { UserVolumePopover } from './UserVolumePopover'

export function VoicePanel() {
  const isInVoice = useVoiceStore((state) => state.channelId !== null)
  const isPanelExpanded = useVoiceStore((state) => state.isPanelExpanded)
  const participants = useVoiceStore((state) => state.participants)
  const selfMuted = useVoiceStore((state) => state.selfMuted)
  const selfDeafened = useVoiceStore((state) => state.selfDeafened)
  const isScreenSharing = useVoiceStore((state) => state.isScreenSharing)
  const togglePanel = useVoiceStore((state) => state.togglePanel)
  const setSelfMuted = useVoiceStore((state) => state.setSelfMuted)
  const setSelfDeafened = useVoiceStore((state) => state.setSelfDeafened)

  const { leaveChannel } = useVoiceCleanup()

  const activeChannel = useChannelStore((state) => {
    const id = state.activeChannelId
    return state.channels.find(c => c.id === id)
  })

  // Debug logging
  console.log('[VoicePanel] isInVoice:', isInVoice, 'activeChannel:', activeChannel?.name, 'type:', activeChannel?.type)

  // Only show when in voice AND viewing a text channel
  // When viewing a voice channel, participants are shown in the channel list instead
  if (!isInVoice || activeChannel?.type === 'voice') {
    console.log('[VoicePanel] Returning null (hidden)')
    return null
  }

  const participantCount = participants.size
  console.log('[VoicePanel] Rendering panel with', participantCount, 'participants')

  const [activeVolumeUser, setActiveVolumeUser] = useState<{
    userId: string
    displayName: string
    username?: string
    avatarUrl?: string
    anchorPosition: { x: number; y: number }
  } | null>(null)

  return (
    <div
      className="shrink-0"
      style={{
        borderTop: '1px solid var(--color-border-default)',
        background: 'var(--color-bg-secondary)',
      }}
    >
      {/* Voice channel header */}
      <div
        className="h-10 px-4 flex items-center justify-between"
        style={{ borderBottom: isPanelExpanded ? '1px solid var(--color-border-default)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#23a559] animate-pulse" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Voice Channel
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {participantCount} {participantCount === 1 ? 'user' : 'users'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Voice controls */}
          <VoiceControlButton
            onClick={() => setSelfMuted(!selfMuted)}
            isActive={!selfMuted}
            isDanger={selfMuted}
            title={selfMuted ? 'Unmute' : 'Mute'}
          >
            {selfMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </VoiceControlButton>

          <VoiceControlButton
            onClick={() => setSelfDeafened(!selfDeafened)}
            isActive={!selfDeafened}
            isDanger={selfDeafened}
            title={selfDeafened ? 'Undeafen' : 'Deafen'}
          >
            {selfDeafened ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
          </VoiceControlButton>

          <VoiceControlButton
            onClick={() => {}}
            isActive={!isScreenSharing}
            title="Share Screen"
          >
            <Monitor size={16} />
          </VoiceControlButton>

          <VoiceControlButton
            onClick={leaveChannel}
            isDanger
            title="Leave"
          >
            <PhoneOff size={16} />
          </VoiceControlButton>

          {/* Collapse/Expand */}
          <button
            onClick={togglePanel}
            className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
            title={isPanelExpanded ? 'Collapse' : 'Expand'}
          >
            {isPanelExpanded ? (
              <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
            ) : (
              <ChevronUp size={16} className="text-[var(--color-text-muted)]" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isPanelExpanded && (
        <div className="p-3">
          {/* Participants grid */}
          <div className="flex flex-wrap gap-2">
            {Array.from(participants.entries()).map(([userId, participant]) => (
              <VoiceParticipantCard
                key={userId}
                userId={userId}
                participant={participant}
                isSelf={userId === 'local'}
                onOpenVolume={(e, displayName, username, avatarUrl) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  setActiveVolumeUser({
                    userId,
                    displayName,
                    username,
                    avatarUrl,
                    anchorPosition: { x: rect.left, y: rect.top - 200 },
                  })
                }}
              />
            ))}

            {/* Add people button */}
            <button
              className="w-12 h-12 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              style={{
                background: 'var(--color-bg-tertiary)',
                border: '1px dashed var(--color-border-default)',
              }}
              title="Invite people"
            >
              <span className="text-xl text-[var(--color-text-muted)]">+</span>
            </button>
          </div>
        </div>
      )}

      {/* Per-User Volume Popover */}
      {activeVolumeUser && (
        <UserVolumePopover
          isOpen={true}
          userId={activeVolumeUser.userId}
          displayName={activeVolumeUser.displayName}
          username={activeVolumeUser.username}
          avatarUrl={activeVolumeUser.avatarUrl}
          anchorPosition={activeVolumeUser.anchorPosition}
          onClose={() => setActiveVolumeUser(null)}
        />
      )}
    </div>
  )
}

interface VoiceControlButtonProps {
  children: React.ReactNode
  onClick?: () => void
  isActive?: boolean
  isDanger?: boolean
  title?: string
}

function VoiceControlButton({
  children,
  onClick,
  isActive = true,
  isDanger = false,
  title,
}: VoiceControlButtonProps) {
  const baseClass = 'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 hover:opacity-80 active:scale-95 cursor-pointer'

  let className = baseClass
  if (isDanger) {
    className += ' bg-[#ed4245] text-white'
  } else if (!isActive) {
    className += ' bg-[#ed4245] text-white'
  } else {
    className += ' bg-[var(--color-bg-tertiary)] text-white'
  }

  return (
    <button
      onClick={onClick}
      className={className}
      title={title}
    >
      {children}
    </button>
  )
}

interface VoiceParticipantCardProps {
  userId: string
  participant: {
    muted: boolean
    deafened: boolean
    isScreenSharing: boolean
    isSpeaking: boolean
    username?: string
    displayName?: string
    avatarUrl?: string
  }
  isSelf: boolean
  onOpenVolume?: (e: React.MouseEvent, displayName: string, username?: string, avatarUrl?: string) => void
}

function VoiceParticipantCard({ userId, participant, isSelf, onOpenVolume }: VoiceParticipantCardProps) {
  const displayName = isSelf ? 'You' : participant.displayName || participant.username || `User ${userId.slice(0, 4)}`
  const userVol = !isSelf ? Math.round(getSavedUserVolume(userId) * 100) : 100
  const isLocallyMuted = !isSelf ? getSavedUserLocalMute(userId) : false

  return (
    <div
      onContextMenu={(e) => {
        if (!isSelf && onOpenVolume) {
          onOpenVolume(e, displayName, participant.username, participant.avatarUrl)
        }
      }}
      className={`group relative w-20 py-2 px-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
        !isSelf ? 'cursor-pointer hover:bg-white/[0.08]' : ''
      }`}
      style={{ background: 'var(--color-bg-tertiary)' }}
      title={!isSelf ? 'Right click or click sliders to adjust user volume' : undefined}
    >
      {/* Avatar with status indicators */}
      <div className="relative">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white overflow-hidden transition-all ${
            participant.isSpeaking ? 'ring-2 ring-[#23a559] ring-offset-1 ring-offset-[#0d121d]' : ''
          }`}
          style={{ background: participant.avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))' }}
        >
          {participant.avatarUrl ? (
            <img src={participant.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            displayName[0].toUpperCase()
          )}
        </div>

        {/* Speaking indicator */}
        {participant.isSpeaking && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#23a559]" />
        )}

        {/* Muted indicator */}
        {participant.muted && !participant.deafened && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-[#ed4245] text-white">
            <MicOff size={8} />
          </div>
        )}

        {/* Deafened indicator */}
        {participant.deafened && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-[#ed4245] text-white">
            <HeadphoneOff size={8} />
          </div>
        )}

        {/* Screen share indicator */}
        {participant.isScreenSharing && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-[#5865f2] text-white">
            <Monitor size={8} />
          </div>
        )}
      </div>

      {/* Username */}
      <span className="text-[10px] text-[var(--color-text-primary)] truncate w-full text-center font-medium">
        {displayName}
      </span>

      {/* Volume Badge or hover button */}
      {!isSelf && (
        <div className="flex items-center gap-1">
          {(isLocallyMuted || userVol !== 100) && (
            <span
              className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold ${
                isLocallyMuted
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : userVol > 100
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isLocallyMuted ? 'MUTED' : `${userVol}%`}
            </span>
          )}

          <button
            type="button"
            onClick={(e) => onOpenVolume?.(e, displayName, participant.username, participant.avatarUrl)}
            className="hidden group-hover:flex items-center justify-center p-0.5 rounded bg-white/10 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 transition-colors"
            title="Adjust volume"
          >
            {isLocallyMuted ? <VolumeX size={10} className="text-rose-400" /> : <Sliders size={10} />}
          </button>
        </div>
      )}
    </div>
  )
}

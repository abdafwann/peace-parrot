import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Monitor, ChevronUp, ChevronDown } from 'lucide-react'
import { useVoiceStore } from '../stores/voiceStore'
import { useVoiceCleanup } from '../hooks/useVoice'
import { useChannelStore } from '../stores/channelStore'

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
            className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
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
              />
            ))}

            {/* Add people button */}
            <button
              className="w-12 h-12 rounded-lg flex items-center justify-center transition-colors"
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
  const baseClass = 'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 hover:opacity-80 active:scale-95'

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
  }
  isSelf: boolean
}

function VoiceParticipantCard({ userId, participant, isSelf }: VoiceParticipantCardProps) {
  const username = isSelf ? 'You' : `User ${userId.slice(0, 4)}`

  return (
    <div
      className="w-20 py-2 px-2 rounded-lg flex flex-col items-center gap-1"
      style={{ background: 'var(--color-bg-tertiary)' }}
    >
      {/* Avatar with status indicators */}
      <div className="relative">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white ${
            participant.isSpeaking ? 'ring-2 ring-[#23a559] ring-4' : ''
          }`}
          style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))' }}
        >
          {username[0].toUpperCase()}
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
      <span className="text-[10px] text-[var(--color-text-primary)] truncate w-full text-center">
        {username}
      </span>
    </div>
  )
}

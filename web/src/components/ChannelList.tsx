import { useState } from 'react'
import { Hash, Volume2, ChevronDown, Plus, MicOff, HeadphoneOff } from 'lucide-react'
import { useChannelStore, type Channel } from '../stores/channelStore'
import { useVoiceStore } from '../stores/voiceStore'
import { useAuthStore } from '../stores/authStore'
import { useWebSocketStore } from '../stores/websocketStore'
import { CreateChannelModal } from './CreateChannelModal'

export function ChannelList() {
  const channels = useChannelStore((state) => state.channels)
  const activeChannelId = useChannelStore((state) => state.activeChannelId)
  const setActiveChannel = useChannelStore((state) => state.setActiveChannel)
  const user = useAuthStore((state) => state.user)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [modalInitialType, setModalInitialType] = useState<'text' | 'voice'>('text')

  const isAdmin =
    user?.role === 'Admin' ||
    user?.username?.toLowerCase() === 'afwan' ||
    user?.username?.toLowerCase() === 'admin' ||
    user?.username?.toLowerCase() === 'gremiwo'

  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  return (
    <div className="flex-1 overflow-y-auto py-2 px-2">
      {/* Text Channels Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-2 mb-1 group">
          <div className="flex items-center gap-1">
            <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Text Channels
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setModalInitialType('text')
                setShowCreateModal(true)
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer p-0.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
              title="Create Text Channel"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {textChannels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === activeChannelId}
              onClick={() => setActiveChannel(channel.id)}
              icon={<Hash size={18} className="shrink-0 text-[var(--color-text-muted)]" />}
            />
          ))}
          {textChannels.length === 0 && (
            <p className="px-2 py-1 text-xs text-[var(--color-text-muted)]">No text channels</p>
          )}
        </div>
      </div>

      {/* Voice Channels Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-2 mb-1 group">
          <div className="flex items-center gap-1">
            <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Voice Channels
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setModalInitialType('voice')
                setShowCreateModal(true)
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer p-0.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
              title="Create Voice Channel"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {voiceChannels.map((channel) => (
            <VoiceChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === activeChannelId}
              onClick={() => setActiveChannel(channel.id)}
            />
          ))}
          {voiceChannels.length === 0 && (
            <p className="px-2 py-1 text-xs text-[var(--color-text-muted)]">No voice channels</p>
          )}
        </div>
      </div>

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        initialType={modalInitialType}
      />
    </div>
  )
}

interface ChannelItemProps {
  channel: Channel
  isActive: boolean
  onClick: () => void
  icon: React.ReactNode
}

function ChannelItem({ channel, isActive, onClick, icon }: ChannelItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer
        transition-all duration-150 group text-left
        ${isActive
          ? 'bg-[var(--color-brand)] text-white shadow-md'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
        }
      `}
    >
      <span className="shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
        {icon}
      </span>
      <span className="truncate font-medium flex-1 text-left">{channel.name}</span>
    </button>
  )
}

interface VoiceChannelItemProps {
  channel: Channel
  isActive: boolean
  onClick?: () => void
}

function VoiceChannelItem({ channel, isActive }: VoiceChannelItemProps) {
  const isInVoice = useVoiceStore((state) => state.channelId !== null)
  const currentChannelId = useVoiceStore((state) => state.channelId)
  const participants = useVoiceStore((state) => state.participants)
  const selfMuted = useVoiceStore((state) => state.selfMuted)
  const selfDeafened = useVoiceStore((state) => state.selfDeafened)
  const setChannelId = useVoiceStore((state) => state.setChannelId)
  const setIsConnected = useVoiceStore((state) => state.setIsConnected)
  const user = useAuthStore((state) => state.user)

  const isInThisChannel = isInVoice && currentChannelId === channel.id
  // Filter participants in this channel (or fallback if channelId matches)
  const channelParticipants = Array.from(participants.entries()).filter(
    ([_, p]) => !p.channelId || p.channelId === channel.id
  )
  const participantCount = channelParticipants.length

  const handleChannelClick = () => {
    if (!isInThisChannel) {
      setChannelId(channel.id)
      setIsConnected(true)

      // Send WebSocket voice_join event with current mute/deafen states
      useWebSocketStore.getState().send({
        type: 'voice_join',
        channelId: channel.id,
        payload: {
          channelId: channel.id,
          selfMuted,
          selfDeafened,
        },
      })
    }
  }

  return (
    <div className="space-y-0.5">
      {/* Channel row - clicking anywhere joins or selects voice channel */}
      <button
        onClick={handleChannelClick}
        className={`
          w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
          transition-all duration-150 group cursor-pointer text-left
          ${isActive || isInThisChannel
            ? 'bg-[var(--color-brand)] text-white shadow-md'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
          }
        `}
      >
        {/* Voice channel icon or activity indicator */}
        {isInThisChannel ? (
          <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#23a559] animate-pulse" />
          </span>
        ) : (
          <Volume2 size={18} className="shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]" />
        )}

        <span className="truncate font-medium flex-1 text-left">{channel.name}</span>

        {/* Participant count when any users are in this channel */}
        {participantCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-medium shrink-0">
            {participantCount}
          </span>
        )}
      </button>

      {/* Expanded participants section - show whenever there are participants in this channel */}
      {channelParticipants.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {channelParticipants.map(([userId, participant]) => {
            const isSelf =
              userId === 'local' ||
              (user?.id && userId === user.id) ||
              (user?.username && participant.username?.toLowerCase() === user.username.toLowerCase())
            const isDeafened = isSelf ? selfDeafened : participant.deafened
            const isMuted = isSelf ? selfMuted : participant.muted
            const displayName = isSelf
              ? user?.displayName || user?.username || 'User'
              : participant.displayName || participant.username || `User ${userId.slice(0, 4)}`
            const initial = displayName[0]?.toUpperCase() || 'U'
            const avatarUrl = isSelf ? user?.avatarUrl : (participant as any).avatarUrl

            return (
              <div
                key={userId}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-[var(--color-bg-hover)]"
                style={{ background: 'var(--color-bg-tertiary)' }}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white transition-all overflow-hidden ${
                      participant.isSpeaking ? 'ring-2 ring-[#23a559]' : ''
                    }`}
                    style={{
                      background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))',
                    }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </div>
                  {/* Status dot */}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-[var(--color-bg-secondary)] ${
                      isDeafened || isMuted ? 'bg-[#ed4245]' : 'bg-[#23a559]'
                    }`}
                  />
                </div>

                {/* Username */}
                <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate font-medium">
                  {displayName}
                </span>

                {/* Status indicators (Mute & Deafen shown separately or together) */}
                <div className="flex items-center gap-1 shrink-0">
                  {isMuted && (
                    <span title="Muted" className="text-[#ed4245]">
                      <MicOff size={14} />
                    </span>
                  )}
                  {isDeafened && (
                    <span title="Deafened" className="text-[#ed4245]">
                      <HeadphoneOff size={14} />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

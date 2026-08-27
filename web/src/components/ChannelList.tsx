import { Hash, Volume2, ChevronDown, Plus } from 'lucide-react'
import { useChannelStore, type Channel } from '../stores/channelStore'

export function ChannelList() {
  const channels = useChannelStore((state) => state.channels)
  const activeChannelId = useChannelStore((state) => state.activeChannelId)
  const setActiveChannel = useChannelStore((state) => state.setActiveChannel)

  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  return (
    <div className="flex-1 overflow-y-auto py-2 px-2">
      {/* Text Channels Section */}
      <div className="mb-4">
        <div className="flex items-center gap-1 px-2 mb-1">
          <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Text Channels
          </span>
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
        <div className="flex items-center gap-1 px-2 mb-1">
          <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Voice Channels
          </span>
        </div>
        <div className="space-y-0.5">
          {voiceChannels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === activeChannelId}
              onClick={() => setActiveChannel(channel.id)}
              icon={<Volume2 size={18} className="shrink-0 text-[var(--color-text-muted)]" />}
            />
          ))}
          {voiceChannels.length === 0 && (
            <p className="px-2 py-1 text-xs text-[var(--color-text-muted)]">No voice channels</p>
          )}
        </div>
      </div>
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
        w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
        transition-all duration-150 group
        ${isActive
          ? 'bg-[var(--color-brand)] text-white shadow-md'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
        }
      `}
    >
      {icon}
      <span className="truncate font-medium flex-1 text-left">{channel.name}</span>

      {/* Add button on hover */}
      {!isActive && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus size={14} className="text-[var(--color-text-muted)]" />
        </span>
      )}
    </button>
  )
}

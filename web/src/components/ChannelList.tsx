import { useState } from 'react'
import {
  Hash,
  Volume2,
  ChevronDown,
  Plus,
  MicOff,
  HeadphoneOff,
  Radio,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useChannelStore, type Channel } from '../stores/channelStore'
import { useVoiceStore } from '../stores/voiceStore'
import { useAuthStore } from '../stores/authStore'
import { useWebSocketStore } from '../stores/websocketStore'
import { CreateChannelModal } from './CreateChannelModal'

export function ChannelList() {
  const channels = useChannelStore((state) => state.channels)
  const activeChannelId = useChannelStore((state) => state.activeChannelId)
  const setActiveChannel = useChannelStore((state) => state.setActiveChannel)
  const reorderChannels = useChannelStore((state) => state.reorderChannels)
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [modalInitialType, setModalInitialType] = useState<'text' | 'voice'>('text')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const isAdmin =
    user?.role === 'Admin' ||
    user?.username?.toLowerCase() === 'afwan' ||
    user?.username?.toLowerCase() === 'admin' ||
    user?.username?.toLowerCase() === 'gremiwo'

  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isAdmin) return
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (!isAdmin || !draggedId || draggedId === id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverId !== id) {
      setDragOverId(id)
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string, channelType: 'text' | 'voice') => {
    e.preventDefault()
    if (!isAdmin || !draggedId || draggedId === targetId) {
      handleDragEnd()
      return
    }

    const targetList = channelType === 'text' ? [...textChannels] : [...voiceChannels]
    const fromIndex = targetList.findIndex((c) => c.id === draggedId)
    const toIndex = targetList.findIndex((c) => c.id === targetId)

    if (fromIndex === -1 || toIndex === -1) {
      handleDragEnd()
      return
    }

    // Reorder within category
    const [moved] = targetList.splice(fromIndex, 1)
    targetList.splice(toIndex, 0, moved)

    // Merge with the other category
    const otherList = channelType === 'text' ? voiceChannels : textChannels
    const fullNewOrder = channelType === 'text' ? [...targetList, ...otherList] : [...otherList, ...targetList]

    await reorderChannels(fullNewOrder, token || undefined)
    handleDragEnd()
  }

  const handleMoveChannel = async (id: string, direction: 'up' | 'down', channelType: 'text' | 'voice') => {
    if (!isAdmin) return
    const targetList = channelType === 'text' ? [...textChannels] : [...voiceChannels]
    const index = targetList.findIndex((c) => c.id === id)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= targetList.length) return

    const [moved] = targetList.splice(index, 1)
    targetList.splice(newIndex, 0, moved)

    const otherList = channelType === 'text' ? voiceChannels : textChannels
    const fullNewOrder = channelType === 'text' ? [...targetList, ...otherList] : [...otherList, ...targetList]

    await reorderChannels(fullNewOrder, token || undefined)
  }

  return (
    <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 select-none">
      {/* Text Channels Section */}
      <div>
        <div className="flex items-center justify-between px-2 mb-1.5 group">
          <div className="flex items-center gap-1">
            <ChevronDown size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Text Channels
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setModalInitialType('text')
                setShowCreateModal(true)
              }}
              className="text-slate-400 hover:text-emerald-400 cursor-pointer p-0.5 rounded hover:bg-white/5 transition-colors"
              title="Create Text Channel"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {textChannels.map((channel, idx) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === activeChannelId}
              onClick={() => setActiveChannel(channel.id)}
              icon={<Hash size={17} className="shrink-0" />}
              isAdmin={isAdmin}
              isFirst={idx === 0}
              isLast={idx === textChannels.length - 1}
              isDragging={draggedId === channel.id}
              isDragOver={dragOverId === channel.id}
              onDragStart={(e) => handleDragStart(e, channel.id)}
              onDragOver={(e) => handleDragOver(e, channel.id)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, channel.id, 'text')}
              onMoveUp={() => handleMoveChannel(channel.id, 'up', 'text')}
              onMoveDown={() => handleMoveChannel(channel.id, 'down', 'text')}
            />
          ))}
          {textChannels.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-400">No text channels</p>
          )}
        </div>
      </div>

      {/* Voice Channels Section */}
      <div>
        <div className="flex items-center justify-between px-2 mb-1.5 group">
          <div className="flex items-center gap-1">
            <ChevronDown size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Voice Channels
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setModalInitialType('voice')
                setShowCreateModal(true)
              }}
              className="text-slate-400 hover:text-emerald-400 cursor-pointer p-0.5 rounded hover:bg-white/5 transition-colors"
              title="Create Voice Channel"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {voiceChannels.map((channel, idx) => (
            <VoiceChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === activeChannelId}
              onClick={() => setActiveChannel(channel.id)}
              isAdmin={isAdmin}
              isFirst={idx === 0}
              isLast={idx === voiceChannels.length - 1}
              isDragging={draggedId === channel.id}
              isDragOver={dragOverId === channel.id}
              onDragStart={(e) => handleDragStart(e, channel.id)}
              onDragOver={(e) => handleDragOver(e, channel.id)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, channel.id, 'voice')}
              onMoveUp={() => handleMoveChannel(channel.id, 'up', 'voice')}
              onMoveDown={() => handleMoveChannel(channel.id, 'down', 'voice')}
            />
          ))}
          {voiceChannels.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-400">No voice channels</p>
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
  isAdmin?: boolean
  isFirst?: boolean
  isLast?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onDrop?: (e: React.DragEvent) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  icon,
  isAdmin,
  isFirst,
  isLast,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onMoveUp,
  onMoveDown,
}: ChannelItemProps) {
  return (
    <div
      draggable={isAdmin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={`relative group rounded-xl transition-all ${
        isDragging ? 'opacity-30 scale-95' : ''
      } ${
        isDragOver ? 'ring-2 ring-emerald-400 bg-emerald-500/10' : ''
      }`}
    >
      <button
        onClick={onClick}
        className={`
          w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer
          transition-all duration-150 text-left relative
          ${isActive
            ? 'bg-emerald-500/15 text-emerald-300 font-semibold shadow-sm border border-emerald-500/20'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }
        `}
      >
        {isAdmin && (
          <span
            className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to reorder"
          >
            <GripVertical size={13} />
          </span>
        )}
        <span className={`shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'}`}>
          {icon}
        </span>
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50" />
        )}
      </button>

      {/* Admin Quick Movement Controls on Hover */}
      {isAdmin && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-[#0d121d]/90 backdrop-blur-md px-1 py-0.5 rounded-lg border border-white/10 shadow-md">
          {!isFirst && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp?.()
              }}
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Move Up"
            >
              <ArrowUp size={11} />
            </button>
          )}
          {!isLast && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown?.()
              }}
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Move Down"
            >
              <ArrowDown size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface VoiceChannelItemProps {
  channel: Channel
  isActive: boolean
  onClick?: () => void
  isAdmin?: boolean
  isFirst?: boolean
  isLast?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onDrop?: (e: React.DragEvent) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function VoiceChannelItem({
  channel,
  isActive,
  isAdmin,
  isFirst,
  isLast,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onMoveUp,
  onMoveDown,
}: VoiceChannelItemProps) {
  const isInVoice = useVoiceStore((state) => state.channelId !== null)
  const currentChannelId = useVoiceStore((state) => state.channelId)
  const participants = useVoiceStore((state) => state.participants)
  const selfMuted = useVoiceStore((state) => state.selfMuted)
  const selfDeafened = useVoiceStore((state) => state.selfDeafened)
  const setChannelId = useVoiceStore((state) => state.setChannelId)
  const setIsConnected = useVoiceStore((state) => state.setIsConnected)
  const user = useAuthStore((state) => state.user)

  const isInThisChannel = isInVoice && currentChannelId === channel.id
  const channelParticipants = Array.from(participants.entries()).filter(
    ([_, p]) => !p.channelId || p.channelId === channel.id
  )
  const participantCount = channelParticipants.length

  const handleChannelClick = () => {
    if (!isInThisChannel) {
      setChannelId(channel.id)
      setIsConnected(true)

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
    <div
      draggable={isAdmin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={`space-y-0.5 relative group rounded-xl transition-all ${
        isDragging ? 'opacity-30 scale-95' : ''
      } ${
        isDragOver ? 'ring-2 ring-emerald-400 bg-emerald-500/10' : ''
      }`}
    >
      {/* Channel row */}
      <div className="relative flex items-center">
        <button
          onClick={handleChannelClick}
          className={`
            w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium
            transition-all duration-150 group cursor-pointer text-left
            ${isInThisChannel
              ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/20 shadow-sm'
              : isActive
              ? 'bg-white/[0.06] text-white'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }
          `}
        >
          {isAdmin && (
            <span
              className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
              title="Drag to reorder"
            >
              <GripVertical size={13} />
            </span>
          )}

          {isInThisChannel ? (
            <span className="w-4 h-4 flex items-center justify-center shrink-0 text-emerald-400">
              <Radio size={15} className="animate-pulse" />
            </span>
          ) : (
            <Volume2 size={16} className="shrink-0 text-slate-400 group-hover:text-slate-300" />
          )}

          <span className="truncate flex-1 text-left">{channel.name}</span>

          {participantCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold shrink-0 border border-emerald-500/30">
              {participantCount}
            </span>
          )}
        </button>

        {/* Admin Quick Movement Controls on Hover */}
        {isAdmin && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-[#0d121d]/90 backdrop-blur-md px-1 py-0.5 rounded-lg border border-white/10 shadow-md z-10">
            {!isFirst && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveUp?.()
                }}
                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Move Up"
              >
                <ArrowUp size={11} />
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveDown?.()
                }}
                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Move Down"
              >
                <ArrowDown size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded participants section */}
      {channelParticipants.length > 0 && (
        <div className="ml-3 pl-2 border-l border-white/5 space-y-1 my-1">
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
                className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors bg-white/[0.02] hover:bg-white/[0.05]"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white transition-all overflow-hidden ${
                      participant.isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#0d121d]' : ''
                    }`}
                    style={{
                      background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--color-brand), #0ea5e9)',
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
                    className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                      isDeafened || isMuted ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>

                {/* Username */}
                <span className="flex-1 text-xs text-slate-300 truncate font-medium">
                  {displayName}
                </span>

                {/* Status indicators */}
                <div className="flex items-center gap-1 shrink-0 text-slate-400">
                  {isMuted && (
                    <span title="Muted" className="text-rose-400">
                      <MicOff size={13} />
                    </span>
                  )}
                  {isDeafened && (
                    <span title="Deafened" className="text-rose-400">
                      <HeadphoneOff size={13} />
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

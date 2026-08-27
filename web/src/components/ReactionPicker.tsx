import { useRef, useEffect } from 'react'

interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}

interface ReactionPickerProps {
  reactions: Reaction[]
  onAddReaction: (emoji: string) => void
  onRemoveReaction: (emoji: string) => void
  onClose: () => void
}

const EMOJI_OPTIONS = [
  '👍', '❤️', '😂', '😮', '😢', '😡',
  '🎉', '🔥', '💯', '👀', '🤔', '👏',
  '🥳', '😍', '🙌', '✨', '🚀', '💪'
]

export function ReactionPicker({
  reactions,
  onAddReaction,
  onRemoveReaction,
  onClose
}: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleEmojiClick = (emoji: string) => {
    const existing = reactions.find(r => r.emoji === emoji)
    if (existing?.reacted) {
      onRemoveReaction(emoji)
    } else {
      onAddReaction(emoji)
    }
    onClose()
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 z-50"
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Emoji grid */}
      <div className="p-2 grid grid-cols-9 gap-1">
        {EMOJI_OPTIONS.map((emoji) => {
          const reaction = reactions.find(r => r.emoji === emoji)
          const isSelected = reaction?.reacted
          return (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg text-lg
                transition-all duration-150 hover:scale-110
                ${isSelected ? 'bg-[var(--color-brand-subtle)]' : 'hover:bg-[var(--color-bg-hover)]'}
              `}
              title={emoji}
            >
              {emoji}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface ReactionDisplayProps {
  reactions: Reaction[]
  onToggle: (emoji: string) => void
  onOpenPicker: () => void
}

export function ReactionDisplay({ reactions, onToggle, onOpenPicker }: ReactionDisplayProps) {
  if (reactions.length === 0) {
    return (
      <button
        onClick={onOpenPicker}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--color-bg-hover)] transition-all duration-150"
        title="Add reaction"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactions.map((reaction) => {
        const bgClass = reaction.reacted ? 'bg-[var(--color-brand-subtle)] border border-[var(--color-brand)]' : 'bg-[var(--color-bg-hover)] border border-transparent hover:border-[var(--color-border-strong)]'
        const countColorClass = reaction.reacted ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'

        return (
          <button
            key={reaction.emoji}
            onClick={() => onToggle(reaction.emoji)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-all duration-150 hover:scale-105 ${bgClass}`}
            title={reaction.reacted ? 'Remove reaction' : 'Add reaction'}
          >
            <span>{reaction.emoji}</span>
            <span className={`text-xs ${countColorClass}`}>{reaction.count}</span>
          </button>
        )
      })}
      <button
        onClick={onOpenPicker}
        className="p-1 rounded hover:bg-[var(--color-bg-hover)] transition-all duration-150"
        title="Add reaction"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </button>
    </div>
  )
}

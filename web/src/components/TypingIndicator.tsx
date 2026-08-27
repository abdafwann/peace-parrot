import { useTypingUsers } from '../stores/websocketStore'

interface TypingIndicatorProps {
  channelId: string
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const typingUserIds = useTypingUsers(channelId)

  if (typingUserIds.length === 0) return null

  const message = typingUserIds.length === 1
    ? `${typingUserIds[0]} is typing`
    : typingUserIds.length === 2
    ? `${typingUserIds[0]} and ${typingUserIds[1]} are typing`
    : `${typingUserIds[0]} and ${typingUserIds.length - 1} others are typing`

  return (
    <div className="px-4 py-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      {/* Typing dots animation */}
      <div className="flex items-center gap-0.5">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" />
      </div>
      <span>{message}</span>
    </div>
  )
}

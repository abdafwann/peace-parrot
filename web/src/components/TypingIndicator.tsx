import { useTypingUsers } from '../stores/websocketStore'
import { useAuthStore } from '../stores/authStore'

interface TypingIndicatorProps {
  channelId: string
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const typingUsers = useTypingUsers(channelId)
  const currentUserId = useAuthStore((s) => s.user?.id)

  // Filter out the current user so you don't see yourself typing
  const otherTypingUsers = typingUsers.filter((u) => u.userId !== currentUserId)

  if (otherTypingUsers.length === 0) return null

  const names = otherTypingUsers.map((u) => u.username || 'Someone')
  const message =
    names.length === 1
      ? `${names[0]} is typing...`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing...`
      : `${names[0]} and ${names.length - 1} others are typing...`

  return (
    <div className="px-5 pt-0 pb-0.5 -mb-0.5 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] animate-fade-in">
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

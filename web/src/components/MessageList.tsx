import { useEffect, useRef, useState } from 'react'
import { useChannelStore } from '../stores/channelStore'
import { useAuthStore } from '../stores/authStore'
import { useWebSocketStore, type WSMessage } from '../stores/websocketStore'
import { format } from 'date-fns'
import { Edit2, MoreHorizontal } from 'lucide-react'
import { ReactionPicker, ReactionDisplay } from './ReactionPicker'
import { LinkPreviews } from './LinkPreview'

interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}

interface Message {
  id: string
  channelId: string
  authorId: string
  authorName?: string
  content: string
  createdAt: string
  editedAt?: string
  deletedAt?: string
  reactions?: Reaction[]
}

export function MessageList() {
  const activeChannelId = useChannelStore((s) => s.activeChannelId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const subscribe = useWebSocketStore((s) => s.subscribe)

  // Fetch messages
  useEffect(() => {
    if (!activeChannelId) return
    setLoading(true)

    fetch(`http://localhost:8080/api/channels/${activeChannelId}/messages?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [activeChannelId])

  // Subscribe to WebSocket messages
  useEffect(() => {
    const unsubscribe = subscribe((message: WSMessage) => {
      if (message.type === 'message' && message.channelId === activeChannelId) {
        const newMessage = message.payload as unknown as Message
        setMessages((prev) => [...prev, newMessage])
      }

      if (message.type === 'message_edit' && message.channelId === activeChannelId) {
        const { id, content, editedAt } = message.payload as { id: string; content: string; editedAt: string }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === id ? { ...msg, content, editedAt } : msg
          )
        )
      }

      if (message.type === 'message_delete' && message.channelId === activeChannelId) {
        const { id } = message.payload as { id: string }
        setMessages((prev) => prev.filter((msg) => msg.id !== id))
      }

      if (message.type === 'reaction_add' && message.channelId === activeChannelId) {
        const { messageId, emoji, userId } = message.payload as { messageId: string; emoji: string; userId: string }
        const currentUserId = useAuthStore.getState().user?.id
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const reactions = msg.reactions || []
              const existing = reactions.find((r) => r.emoji === emoji)
              if (existing) {
                return {
                  ...msg,
                  reactions: reactions.map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count + 1, reacted: r.reacted || userId === currentUserId }
                      : r
                  ),
                }
              } else {
                return {
                  ...msg,
                  reactions: [...reactions, { emoji, count: 1, reacted: userId === currentUserId }],
                }
              }
            }
            return msg
          })
        )
      }

      if (message.type === 'reaction_remove' && message.channelId === activeChannelId) {
        const { messageId, emoji } = message.payload as { messageId: string; emoji: string }
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const reactions = msg.reactions || []
              return {
                ...msg,
                reactions: reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count - 1, reacted: false }
                      : r
                  )
                  .filter((r) => r.count > 0),
              }
            }
            return msg
          })
        )
      }
    })

    return unsubscribe
  }, [activeChannelId, subscribe])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (!activeChannelId) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        <p>Select a channel to view messages</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">Loading messages...</div>
      </div>
    )
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg mb-2 text-[var(--color-text-secondary)]">No messages yet</p>
              <p className="text-sm text-[var(--color-text-muted)]">Be the first to say something! 👋</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <MessageItem key={msg.id} message={msg} index={index} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </>
  )
}

function MessageItem({ message, index = 0 }: { message: Message; index?: number }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(message.content)
  const [showMenu, setShowMenu] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const isOwn = message.authorId === currentUserId
  const reactions = message.reactions || []

  const formattedTime = (() => {
    try {
      const date = new Date(message.createdAt)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()

      if (isToday) {
        return format(date, 'h:mm a')
      } else {
        return format(date, 'MMM d, h:mm a')
      }
    } catch {
      return message.createdAt
    }
  })()

  const handleAddReaction = async (emoji: string) => {
    try {
      await fetch(`http://localhost:8080/api/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      // Optimistic update
      const existing = reactions.find((r) => r.emoji === emoji)
      if (existing) {
        message.reactions = reactions.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
        )
      } else {
        message.reactions = [...reactions, { emoji, count: 1, reacted: true }]
      }
    } catch (err) {
      console.error('Failed to add reaction:', err)
    }
  }

  const handleRemoveReaction = async (emoji: string) => {
    try {
      await fetch(`http://localhost:8080/api/messages/${message.id}/reactions/${encodeURIComponent(emoji)}`, {
        method: 'DELETE',
      })
      // Optimistic update
      message.reactions = reactions
        .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r))
        .filter((r) => r.count > 0)
    } catch (err) {
      console.error('Failed to remove reaction:', err)
    }
  }

  const handleToggleReaction = (emoji: string) => {
    const reaction = reactions.find((r) => r.emoji === emoji)
    if (reaction?.reacted) {
      handleRemoveReaction(emoji)
    } else {
      handleAddReaction(emoji)
    }
  }

  if (message.deletedAt) {
    return (
      <div className="py-2 px-3 text-sm italic text-[var(--color-text-muted)]">
        Message was deleted
      </div>
    )
  }

  return (
    <div
      className="group py-2 px-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors message-appear relative"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))` }}
        >
          {(message.authorName || 'U')[0].toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: name + timestamp */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-[var(--color-text-primary)]">
              {message.authorName || 'User'}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {formattedTime}
            </span>
            {message.editedAt && (
              <span className="text-xs text-[var(--color-text-muted)]">(edited)</span>
            )}
          </div>

          {/* Message body */}
          {editing ? (
            <form onSubmit={handleSave} className="flex gap-2 mt-1">
              <input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="input flex-1 py-1"
                autoFocus
              />
              <button type="submit" className="btn btn-primary py-1 px-3 text-sm">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost py-1 px-3 text-sm">Cancel</button>
            </form>
          ) : (
            <>
              <p className="text-[var(--color-text-primary)] break-words whitespace-pre-wrap">
                {message.content}
              </p>

              {/* Link Previews */}
              <LinkPreviews content={message.content} />
            </>
          )}

          {/* Reactions */}
          {(reactions.length > 0 || true) && (
            <div className="mt-2 relative">
              <ReactionDisplay
                reactions={reactions}
                onToggle={handleToggleReaction}
                onOpenPicker={() => setShowReactionPicker(true)}
              />

              {showReactionPicker && (
                <ReactionPicker
                  reactions={reactions}
                  onAddReaction={handleAddReaction}
                  onRemoveReaction={handleRemoveReaction}
                  onClose={() => setShowReactionPicker(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 transition-opacity">
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-1.5 rounded hover:bg-[var(--color-bg-active)] transition-colors"
            title="Add reaction"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </button>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded hover:bg-[var(--color-bg-active)] transition-colors"
            title="More actions"
          >
            <MoreHorizontal size={16} className="text-[var(--color-text-muted)]" />
          </button>

          {isOwn && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded hover:bg-[var(--color-bg-active)] transition-colors"
              title="Edit message"
            >
              <Edit2 size={16} className="text-[var(--color-text-muted)]" />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  function handleSave() {
    // TODO: Send edit to backend
    setEditing(false)
  }
}

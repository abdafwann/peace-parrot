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
  const subscribeChannel = useWebSocketStore((s) => s.subscribeChannel)

  // Subscribe to channel when active channel changes
  useEffect(() => {
    if (!activeChannelId) return

    // Send channel_join to subscribe to broadcasts
    subscribeChannel(activeChannelId)
  }, [activeChannelId, subscribeChannel])

  // Fetch messages
  useEffect(() => {
    if (!activeChannelId) return
    setLoading(true)

    fetch(`http://localhost:8080/api/channels/${activeChannelId}/messages?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const normalized: Message[] = data.map((item: any) => ({
            id: item.id,
            channelId: item.channelId || item.channel_id,
            authorId: item.authorId || item.author_id,
            authorName: item.authorName || item.author_name,
            content: item.content,
            createdAt: item.createdAt || item.created_at || new Date().toISOString(),
            editedAt: item.editedAt || item.edited_at,
            deletedAt: item.deletedAt || item.deleted_at,
            reactions: item.reactions || [],
          }))
          // Reverse so oldest messages are at the top and newest at the bottom
          setMessages(normalized.reverse())
        } else {
          setMessages([])
        }
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
      console.log('[MessageList] WS event:', message.type, 'payload:', message.payload)

      if (message.type === 'message') {
        const payload = (message.payload || {}) as Record<string, any>
        const nested = payload.message as Record<string, any> | undefined

        const channelId = (payload.channelId || message.channelId || nested?.channelId) as string
        const id = (nested?.id || payload.id) as string
        const authorId = (nested?.authorId || payload.authorId) as string
        const authorName = (nested?.authorName || payload.authorName) as string | undefined
        const content = (nested?.content || payload.content) as string
        const createdAt = (nested?.createdAt || payload.createdAt || new Date().toISOString()) as string

        if (channelId === activeChannelId && id) {
          console.log('[MessageList] Adding message to list:', id)
          const newMessage: Message = {
            id,
            channelId,
            authorId: authorId || '',
            authorName,
            content: content || '',
            createdAt,
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === id)) return prev
            return [...prev, newMessage]
          })
        }
      }

      if (message.type === 'message_edit') {
        const payload = (message.payload || {}) as Record<string, any>
        const channelId = (payload.channelId || message.channelId) as string
        const messageId = (payload.messageId || payload.id) as string
        const content = payload.content as string
        const editedAt = (payload.editedAt || new Date().toISOString()) as string

        if (channelId === activeChannelId && messageId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, content, editedAt } : msg
            )
          )
        }
      }

      if (message.type === 'message_delete') {
        const payload = (message.payload || {}) as Record<string, any>
        const channelId = (payload.channelId || message.channelId) as string
        const messageId = (payload.messageId || payload.id) as string

        if (channelId === activeChannelId && messageId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
        }
      }

      if (message.type === 'reaction_add') {
        const payload = (message.payload || {}) as Record<string, any>
        const channelId = (payload.channelId || message.channelId) as string
        const messageId = payload.messageId as string
        const emoji = payload.emoji as string
        const userId = (payload.userId || payload.user?.id) as string

        if (channelId === activeChannelId && messageId && emoji) {
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
      }

      if (message.type === 'reaction_remove') {
        const payload = (message.payload || {}) as Record<string, any>
        const channelId = (payload.channelId || message.channelId) as string
        const messageId = payload.messageId as string
        const emoji = payload.emoji as string

        if (channelId === activeChannelId && messageId && emoji) {
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
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </>
  )
}

function MessageItem({ message }: { message: Message }) {
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

          {/* Reactions - only show if there are actual reactions */}
          {reactions.length > 0 && (
            <div className="mt-2 relative">
              <ReactionDisplay
                reactions={reactions}
                onToggle={handleToggleReaction}
                onOpenPicker={() => setShowReactionPicker(true)}
              />
            </div>
          )}

          {showReactionPicker && (
            <div className="relative">
              <ReactionPicker
                reactions={reactions}
                onAddReaction={handleAddReaction}
                onRemoveReaction={handleRemoveReaction}
                onClose={() => setShowReactionPicker(false)}
              />
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

import { useEffect, useRef, useState } from 'react'
import { useChannelStore } from '../stores/channelStore'
import { useAuthStore } from '../stores/authStore'
import { API_BASE_URL } from '../utils/config'
import { useServerStore } from '../stores/serverStore'
import { useWebSocketStore, type WSMessage } from '../stores/websocketStore'
import { format } from 'date-fns'
import { Edit2, MoreHorizontal, FileText, Download } from 'lucide-react'
import { ReactionPicker, ReactionDisplay } from './ReactionPicker'
import { LinkPreviews } from './LinkPreview'
import { RoleBadge } from './RoleBadge'
import { ImageLightboxModal } from './ImageLightboxModal'
import { useSettingsStore } from '../stores/settingsStore'
import { playSoundEffect, showDesktopNotification } from '../utils/soundEffects'

interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}

export interface Attachment {
  id: string
  url: string
  filename: string
  size: number
  type: string
  mimeType: string
}

export interface Message {
  id: string
  channelId: string
  authorId: string
  authorName?: string
  authorAvatarUrl?: string
  content: string
  attachments?: Attachment[]
  createdAt: string
  editedAt?: string
  deletedAt?: string
  reactions?: Reaction[]
}

// Helper to safely parse any datetime format into local Date
function parseMessageDate(dateInput: string | Date | undefined): Date {
  if (!dateInput) return new Date()
  if (dateInput instanceof Date) return dateInput
  let str = String(dateInput).trim()
  if (!str.includes('Z') && !str.includes('+') && !str.includes('T')) {
    str = str.replace(' ', 'T') + 'Z'
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? new Date() : d
}

function formatMessageTime(dateInput: string | Date | undefined): string {
  try {
    const date = parseMessageDate(dateInput)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()

    const clock = format(date, 'HH:mm') // e.g. 21:35 or 13:49

    if (isToday) {
      return clock
    } else if (isYesterday) {
      return `Yesterday at ${clock}`
    } else {
      return `${format(date, 'dd/MM/yyyy')} ${clock}`
    }
  } catch {
    return ''
  }
}

export function MessageList() {
  const activeChannelId = useChannelStore((s) => s.activeChannelId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [usersMap, setUsersMap] = useState<Record<string, any>>({})
  const roles = useServerStore((state) => state.roles)
  const fetchRoles = useServerStore((state) => state.fetchRoles)
  const subscribe = useWebSocketStore((s) => s.subscribe)
  const subscribeChannel = useWebSocketStore((s) => s.subscribeChannel)

  const [lightboxImage, setLightboxImage] = useState<{ url: string; filename?: string } | null>(null)

  // Fetch roles and registered users map
  const fetchUsers = () => {
    fetch(`${API_BASE_URL}/api/users`)
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) {
          const map: Record<string, any> = {}
          list.forEach((u: any) => {
            if (u.id) map[u.id] = u
            if (u.username) map[u.username.toLowerCase()] = u
          })
          setUsersMap(map)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchRoles()
    fetchUsers()
  }, [])

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

    fetch(`${API_BASE_URL}/api/channels/${activeChannelId}/messages?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const normalized: Message[] = data.map((item: any) => {
            const authorObj = item.authorId ? usersMap[item.authorId] : undefined
            return {
              id: item.id,
              channelId: item.channelId || item.channel_id,
              authorId: item.authorId || item.author_id,
              authorName: item.authorName || item.author_name || authorObj?.displayName || authorObj?.username,
              authorAvatarUrl: item.authorAvatarUrl || item.author_avatar_url || authorObj?.avatarUrl,
              content: item.content,
              attachments: item.attachments || [],
              createdAt: item.createdAt || item.created_at || new Date().toISOString(),
              editedAt: item.editedAt || item.edited_at,
              deletedAt: item.deletedAt || item.deleted_at,
              reactions: item.reactions || [],
            }
          })
          // Filter out any duplicates and reverse so oldest messages are at top
          const seen = new Set<string>()
          const unique = normalized.filter((m) => {
            if (seen.has(m.id)) return false
            seen.add(m.id)
            return true
          })
          setMessages(unique.reverse())
        } else {
          setMessages([])
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [activeChannelId, usersMap])

  // Subscribe to WebSocket messages
  useEffect(() => {
    const unsubscribe = subscribe((message: WSMessage) => {
      console.log('[MessageList] WS event:', message.type, 'payload:', message.payload)

      if (message.type === 'presence_sync' || message.type === 'user_presence' || message.type === 'user_role_updated') {
        fetchUsers()
      }

      if (message.type === 'message') {
        const payload = (message.payload || {}) as Record<string, any>
        const nested = payload.message as Record<string, any> | undefined

        const channelId = (payload.channelId || message.channelId || nested?.channelId) as string
        const id = (nested?.id || payload.id) as string
        const authorId = (nested?.authorId || payload.authorId) as string
        const authorObj = authorId ? usersMap[authorId] : undefined
        const authorName = (nested?.authorName || payload.authorName || authorObj?.displayName || authorObj?.username) as string | undefined
        const authorAvatarUrl = (nested?.authorAvatarUrl || payload.authorAvatarUrl || nested?.author_avatar_url || payload.author_avatar_url || authorObj?.avatarUrl) as string | undefined
        const content = (nested?.content || payload.content) as string
        const attachments = (nested?.attachments || payload.attachments || []) as Attachment[]
        const createdAt = (nested?.createdAt || payload.createdAt || new Date().toISOString()) as string

        if (channelId === activeChannelId && id) {
          console.log('[MessageList] Adding message to list:', id)
          const currentUserId = useAuthStore.getState().user?.id
          if (authorId && authorId !== currentUserId) {
            playSoundEffect('message')
            showDesktopNotification(authorName || 'PeaceParrot', { body: content || 'New message' })
          }

          const newMessage: Message = {
            id,
            channelId,
            authorId: authorId || '',
            authorName,
            authorAvatarUrl,
            content: content || '',
            attachments,
            createdAt,
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === id)) return prev
            // Also deduplicate identical author/content in close timeframe
            if (prev.some((m) => m.channelId === channelId && m.authorId === authorId && m.content === content && Math.abs(new Date(m.createdAt).getTime() - new Date(createdAt).getTime()) < 1500)) {
              return prev
            }
            return [...prev, newMessage]
          })
        }
      }

      if (message.type === 'message_edit') {
        const payload = (message.payload || {}) as Record<string, any>
        const channelId = (payload.channelId || message.channelId) as string
        const messageId = (payload.id || payload.messageId) as string
        const content = payload.content as string

        if (channelId === activeChannelId && messageId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content, editedAt: new Date().toISOString() }
                : msg
            )
          )
        }
      }

      if (message.type === 'message_delete') {
        const payload = (message.payload || {}) as Record<string, any>
        const channelId = (payload.channelId || message.channelId) as string
        const messageId = (payload.id || payload.messageId) as string

        if (channelId === activeChannelId && messageId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, deletedAt: new Date().toISOString() }
                : msg
            )
          )
        }
      }

      if (message.type === 'reaction_add') {
        const payload = (message.payload || {}) as Record<string, any>
        const channelId = (payload.channelId || message.channelId) as string
        const messageId = payload.messageId as string
        const emoji = payload.emoji as string

        if (channelId === activeChannelId && messageId && emoji) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === messageId) {
                const reactions = msg.reactions || []
                const existing = reactions.find((r) => r.emoji === emoji)
                if (existing) {
                  return {
                    ...msg,
                    reactions: reactions.map((r) =>
                      r.emoji === emoji ? { ...r, count: r.count + 1 } : r
                    ),
                  }
                } else {
                  return {
                    ...msg,
                    reactions: [...reactions, { emoji, count: 1, reacted: false }],
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

      if (message.type === 'user_role_updated') {
        const payload = (message.payload || {}) as { userId?: string; role?: string }
        if (payload.userId && payload.role) {
          setUsersMap((prev) => {
            const next = { ...prev }
            if (next[payload.userId!]) {
              next[payload.userId!] = { ...next[payload.userId!], role: payload.role }
            }
            for (const key of Object.keys(next)) {
              if (next[key]?.id === payload.userId) {
                next[key] = { ...next[key], role: payload.role }
              }
            }
            return next
          })
        }
      }

      if (
        message.type === 'role_created' ||
        message.type === 'role_updated' ||
        message.type === 'role_deleted' ||
        message.type === 'server_settings_updated'
      ) {
        fetchRoles()
      }
    })

    return unsubscribe
  }, [activeChannelId, subscribe, fetchRoles])

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
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1]
              let isStacked = false

              if (prevMsg && !msg.deletedAt && !prevMsg.deletedAt) {
                const isSameAuthor =
                  (msg.authorId && prevMsg.authorId && msg.authorId === prevMsg.authorId) ||
                  (msg.authorName && prevMsg.authorName && msg.authorName === prevMsg.authorName)

                const currTime = parseMessageDate(msg.createdAt).getTime()
                const prevTime = parseMessageDate(prevMsg.createdAt).getTime()
                const diffMinutes = (currTime - prevTime) / (1000 * 60)

                const isSameDay =
                  parseMessageDate(msg.createdAt).toDateString() ===
                  parseMessageDate(prevMsg.createdAt).toDateString()

                // Stack if same author, under 10 minutes, and same day
                if (isSameAuthor && diffMinutes >= 0 && diffMinutes < 10 && isSameDay) {
                  isStacked = true
                }
              }

              return (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  usersMap={usersMap}
                  roles={roles}
                  isStacked={isStacked}
                  onOpenLightbox={(url, filename) => setLightboxImage({ url, filename })}
                />
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImage)}
        imageUrl={lightboxImage?.url || ''}
        filename={lightboxImage?.filename}
        onClose={() => setLightboxImage(null)}
      />
    </>
  )
}

function MessageItem({
  message,
  usersMap,
  roles,
  isStacked = false,
  onOpenLightbox,
}: {
  message: Message
  usersMap: Record<string, any>
  roles: any[]
  isStacked?: boolean
  onOpenLightbox: (url: string, filename?: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(message.content)
  const [showMenu, setShowMenu] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const isOwn = message.authorId === currentUserId
  const reactions = message.reactions || []

  // Resolve author role and role badge
  const authorUser =
    usersMap[message.authorId] ||
    (message.authorName ? usersMap[message.authorName.toLowerCase()] : null)
  const roleName = authorUser?.role || 'Member'
  const userRole =
    roles.find(
      (r) => r.name?.toLowerCase() === roleName?.toLowerCase() || r.id === roleName
    ) ||
    (roleName?.toLowerCase() === 'admin'
      ? { name: 'Admin', color: '#f0b232', iconUrl: '👑' }
      : roleName?.toLowerCase() === 'moderator'
      ? { name: 'Moderator', color: '#23a559', iconUrl: '🛡️' }
      : null)

  const formattedTime = formatMessageTime(message.createdAt)

  const shortTime = (() => {
    try {
      const date = parseMessageDate(message.createdAt)
      return format(date, 'HH:mm')
    } catch {
      return ''
    }
  })()

  const handleAddReaction = async (emoji: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/messages/${message.id}/reactions`, {
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
      await fetch(`${API_BASE_URL}/api/messages/${message.id}/reactions/${encodeURIComponent(emoji)}`, {
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

  const chatDisplayMode = useSettingsStore((s) => s.chatDisplayMode)

  if (message.deletedAt) {
    return (
      <div className="py-1 px-3 text-sm italic text-[var(--color-text-muted)]">
        Message was deleted
      </div>
    )
  }

  const isCompact = chatDisplayMode === 'compact'

  return (
    <div
      className={`group rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors message-appear relative ${
        isStacked ? 'py-0.5 px-2 -mt-0.5' : isCompact ? 'py-1 px-2 mt-2' : 'py-2 px-2 mt-3'
      }`}
    >
      <div className="flex gap-3 items-start">
        {/* Left Gutter: Avatar (if not stacked) OR Timestamp on left (if stacked) */}
        {!isCompact && (
          <div className="w-10 shrink-0 flex items-center justify-center">
            {isStacked ? (
              <span className="text-[10px] text-[var(--color-text-muted)] text-right w-full pr-1 select-none opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                {shortTime}
              </span>
            ) : (
              <div
                className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white overflow-hidden shadow-sm"
                style={{
                  background: message.authorAvatarUrl
                    ? 'transparent'
                    : 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))',
                }}
              >
                {message.authorAvatarUrl ? (
                  <img src={message.authorAvatarUrl} alt={message.authorName || 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  (message.authorName || 'U')[0].toUpperCase()
                )}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: name + role badge + timestamp (Only rendered on the first message of a stack) */}
          {!isStacked && (
            <div className={`flex items-baseline gap-1.5 flex-wrap ${isCompact ? 'inline mr-2' : 'mb-1'}`}>
              <span
                className="font-semibold text-sm cursor-pointer hover:underline leading-snug"
                style={{ color: userRole?.color || 'var(--color-text-primary)' }}
              >
                {message.authorName || 'User'}
              </span>
              {userRole && <RoleBadge role={userRole} roleName={roleName} className="self-center" />}
              <span className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                {formattedTime}
              </span>
              {message.editedAt && (
                <span className="text-[11px] text-[var(--color-text-muted)] leading-snug">(edited)</span>
              )}
            </div>
          )}

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
              {/* Message text */}
              {message.content && (
                <span className={`text-[var(--color-text-primary)] text-sm break-words whitespace-pre-wrap leading-relaxed ${isCompact ? 'inline' : 'block'}`}>
                  {message.content}
                </span>
              )}

              {/* Attachments (Images, Audio, Video, Files) */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2.5 max-w-2xl">
                  {message.attachments.map((att) => {
                    const isImg = att.type === 'image' || att.mimeType?.startsWith('image/')
                    const isAudio = att.type === 'audio' || att.mimeType?.startsWith('audio/')
                    const isVideo = att.type === 'video' || att.mimeType?.startsWith('video/')

                    if (isImg) {
                      return (
                        <div
                          key={att.id}
                          onClick={() => onOpenLightbox(att.url, att.filename)}
                          className="relative rounded-2xl overflow-hidden cursor-pointer group bg-black/20 max-w-sm max-h-80 border border-[var(--color-border-default)] hover:border-[var(--color-brand)] transition-all shadow-md"
                        >
                          <img
                            src={att.url}
                            alt={att.filename}
                            className="w-auto h-auto max-h-72 object-contain group-hover:scale-[1.02] transition-transform duration-200"
                            loading="lazy"
                          />
                        </div>
                      )
                    }

                    if (isAudio) {
                      return (
                        <div
                          key={att.id}
                          className="p-3 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] w-full max-w-md shadow-sm"
                        >
                          <div className="text-xs font-semibold mb-1.5 truncate text-[var(--color-text-primary)]">
                            {att.filename}
                          </div>
                          <audio controls src={att.url} className="w-full h-8" />
                        </div>
                      )
                    }

                    if (isVideo) {
                      return (
                        <div
                          key={att.id}
                          className="rounded-2xl overflow-hidden max-w-md bg-black border border-[var(--color-border-default)] shadow-md"
                        >
                          <video controls src={att.url} className="w-full max-h-80" />
                        </div>
                      )
                    }

                    return (
                      <a
                        key={att.id}
                        href={att.url}
                        download={att.filename}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] transition-all max-w-xs group shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand)] flex items-center justify-center shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate group-hover:underline">
                            {att.filename}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">
                            {(att.size / 1024).toFixed(0)} KB
                          </div>
                        </div>
                        <Download size={16} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-brand)] shrink-0" />
                      </a>
                    )
                  })}
                </div>
              )}

              {/* Link Previews */}
              {message.content && <LinkPreviews content={message.content} />}
            </>
          )}

          {/* Reactions - only show if there are actual reactions */}
          {reactions.length > 0 && (
            <div className="mt-1 relative">
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

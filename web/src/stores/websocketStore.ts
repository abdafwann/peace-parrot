import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { useMessageStore } from './messageStore'
import { useVoiceStore } from './voiceStore'

export type WSEventType =
  | 'channel_join'
  | 'message'
  | 'message_edit'
  | 'message_delete'
  | 'reaction_add'
  | 'reaction_remove'
  | 'typing_start'
  | 'typing_stop'
  | 'user_online'
  | 'user_offline'
  | 'presence_sync'
  | 'user_presence'
  | 'voice_room_state'
  | 'voice_join'
  | 'voice_leave'
  | 'voice_state_update'
  | 'user_joined_voice'
  | 'user_left_voice'
  | 'user_muted'
  | 'user_role_updated'
  | 'role_created'
  | 'role_updated'
  | 'role_deleted'
  | 'server_settings_updated'
  | 'soundboard_play'
  | 'soundboard_item_add'
  | 'soundboard_item_delete'
  | 'speaking'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'webrtc_ice'

export interface WSMessage {
  type: WSEventType
  channelId?: string
  payload: Record<string, unknown>
}

export interface TypingUser {
  userId: string
  username: string
}

interface WebSocketState {
  // Queued messages (sent when connected/reconnected)
  pendingMessages: WSMessage[]
  // Tracked channels to auto-resubscribe on connect/reconnect
  subscribedChannels: Set<string>

  // Connection state
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  socket: WebSocket | null

  // Typing state
  typingUsers: Record<string, TypingUser[]> // channelId -> typing users

  // Message handlers
  messageHandlers: Set<(message: WSMessage) => void>

  // Actions
  connect: (token: string) => void
  disconnect: () => void
  send: (message: WSMessage) => void
  subscribeChannel: (channelId: string) => void
  subscribe: (handler: (message: WSMessage) => void) => () => void

  // Typing actions
  startTyping: (channelId: string) => void
  stopTyping: (channelId: string) => void
}

import { getWsUrl, probeAndAutoFallbackEndpoint } from '../utils/config'

const RECONNECT_DELAY = 3000

export const useWebSocketStore = create<WebSocketState>()(
  devtools(
    (set, get) => ({
      pendingMessages: [],
      subscribedChannels: new Set(),
      isConnected: false,
      isConnecting: false,
      error: null,
      socket: null,
      typingUsers: {},
      messageHandlers: new Set(),

      connect: (token: string) => {
        const { socket, isConnecting } = get()

        // Don't connect if already connected or connecting
        if (socket?.readyState === WebSocket.OPEN || isConnecting) return

        set({ isConnecting: true, error: null })

        const currentWsUrl = getWsUrl()

        try {
          console.log('[WS] Connecting to:', currentWsUrl)
          const ws = new WebSocket(`${currentWsUrl}?token=${token}`)

          ws.onopen = () => {
            console.log('[WS] Connected successfully to:', currentWsUrl)
            set({ isConnected: true, isConnecting: false, socket: ws, error: null })

            const { subscribedChannels, pendingMessages } = get()

            // Re-subscribe to all active channels
            subscribedChannels.forEach((channelId) => {
              ws.send(
                JSON.stringify({
                  type: 'channel_join',
                  channelId,
                  payload: { channelId },
                })
              )
            })

            // Flush pending messages
            if (pendingMessages.length > 0) {
              console.log('[WS] Flushing pending messages:', pendingMessages.length)
              pendingMessages.forEach((msg) => {
                ws.send(JSON.stringify(msg))
              })
              set({ pendingMessages: [] })
            }
          }

          ws.onclose = (event) => {
            console.log('[WS] Disconnected', event.code, event.reason)
            set({ isConnected: false, isConnecting: false, socket: null })

            // If non-localhost failed, probe localhost fallback
            if (!currentWsUrl.includes('localhost:8080') && !currentWsUrl.includes('127.0.0.1:8080')) {
              probeAndAutoFallbackEndpoint().catch(() => {})
            }

            // Don't reconnect if manually closed
            if (event.code !== 1000) {
              console.log('[WS] Reconnecting in', RECONNECT_DELAY, 'ms')
              setTimeout(() => {
                const currentToken = getTokenFromStore()
                if (currentToken) get().connect(currentToken)
              }, RECONNECT_DELAY)
            } else {
              console.log('[WS] Not reconnecting - user disconnected')
            }
          }

          ws.onerror = (error) => {
            console.error('[WS] Error connecting to:', currentWsUrl, error)
            // Auto fallback to localhost if remote tunnel failed
            if (!currentWsUrl.includes('localhost:8080') && !currentWsUrl.includes('127.0.0.1:8080')) {
              probeAndAutoFallbackEndpoint().catch(() => {})
            }
          }

          ws.onmessage = (event) => {
            try {
              const message: WSMessage = JSON.parse(event.data)
              console.log('[WS] Received:', message.type, message)
              handleMessage(message)
            } catch (err) {
              console.error('[WS] Failed to parse message:', err)
            }
          }

          set({ socket: ws })
        } catch (err) {
          console.error('[WS] Failed to create WebSocket connection:', err)
          set({ isConnecting: false, error: 'Failed to connect to server' })
          if (!currentWsUrl.includes('localhost:8080')) {
            probeAndAutoFallbackEndpoint().catch(() => {})
          }
        }
      },

      disconnect: () => {
        const { socket } = get()
        if (socket) {
          socket.close(1000, 'User logged out')
          set({ socket: null, isConnected: false, isConnecting: false, pendingMessages: [] })
        }
      },

      send: (message: WSMessage) => {
        const { socket, isConnected } = get()

        if (socket?.readyState === WebSocket.OPEN && isConnected) {
          socket.send(JSON.stringify(message))
        } else {
          console.log('[WS] Socket not open, queueing message:', message)
          set((state) => ({
            pendingMessages: [...state.pendingMessages, message],
          }))
        }
      },

      subscribeChannel: (channelId: string) => {
        const { socket, isConnected, subscribedChannels } = get()

        // Add to tracked channels
        set({ subscribedChannels: new Set([...subscribedChannels, channelId]) })

        // Send subscribe message if connected
        if (socket?.readyState === WebSocket.OPEN && isConnected) {
          socket.send(
            JSON.stringify({
              type: 'channel_join',
              channelId,
              payload: { channelId },
            })
          )
        }
      },

      subscribe: (handler: (message: WSMessage) => void) => {
        const { messageHandlers } = get()
        messageHandlers.add(handler)
        return () => {
          messageHandlers.delete(handler)
        }
      },

      startTyping: (channelId: string) => {
        const { send } = get()
        send({
          type: 'typing_start',
          channelId,
          payload: { channelId },
        })
      },

      stopTyping: (channelId: string) => {
        const { send } = get()
        send({
          type: 'typing_stop',
          channelId,
          payload: { channelId },
        })
      },
    }),
    { name: 'WebSocketStore' }
  )
)

// Auto-reconnect when active API/WS base URL changes (e.g. from cloudflare tunnel to localhost)
if (typeof window !== 'undefined') {
  window.addEventListener('api-base-url-changed', () => {
    const currentToken = getTokenFromStore()
    const { socket } = useWebSocketStore.getState()
    if (currentToken && socket) {
      try {
        socket.close()
      } catch {}
      useWebSocketStore.getState().connect(currentToken)
    }
  })
}

// Helper to handle incoming messages
function handleMessage(message: WSMessage) {
  const { messageHandlers, typingUsers } = useWebSocketStore.getState()

  // Notify all component subscribers
  messageHandlers.forEach((handler) => {
    try {
      handler(message)
    } catch (e) {
      console.error('[WS] Error in message handler:', e)
    }
  })

  // Handle message events in messageStore
  const messageStore = useMessageStore.getState()

  if (message.type === 'message') {
    const payload = (message.payload || {}) as Record<string, any>
    const nested = payload.message as Record<string, any> | undefined

    const channelId = (payload.channelId || message.channelId || nested?.channelId) as string
    const id = (nested?.id || payload.id) as string
    const authorId = (nested?.authorId || payload.authorId) as string
    const content = (nested?.content || payload.content) as string
    const createdAt = (nested?.createdAt || payload.createdAt || new Date().toISOString()) as string

    if (channelId && id) {
      messageStore.addMessage(channelId, {
        id,
        channelId,
        authorId: authorId || '',
        content: content || '',
        createdAt,
      })
    }
  }

  if (message.type === 'message_edit') {
    const payload = (message.payload || {}) as Record<string, any>
    const channelId = (payload.channelId || message.channelId) as string
    const messageId = (payload.messageId || payload.id) as string
    const content = payload.content as string

    if (channelId && messageId && content !== undefined) {
      messageStore.updateMessage(channelId, messageId, content)
    }
  }

  if (message.type === 'message_delete') {
    const payload = (message.payload || {}) as Record<string, any>
    const channelId = (payload.channelId || message.channelId) as string
    const messageId = (payload.messageId || payload.id) as string

    if (channelId && messageId) {
      messageStore.removeMessage(channelId, messageId)
    }
  }

  if (message.type === 'reaction_add') {
    const payload = (message.payload || {}) as Record<string, any>
    const messageId = payload.messageId as string
    const emoji = payload.emoji as string
    const user = (payload.user || (payload.userId ? { id: payload.userId, username: 'User' } : undefined)) as
      | { id: string; username: string }
      | undefined

    if (messageId && emoji && user) {
      messageStore.addReaction(messageId, emoji, user)
    }
  }

  if (message.type === 'reaction_remove') {
    const payload = (message.payload || {}) as Record<string, any>
    const messageId = payload.messageId as string
    const emoji = payload.emoji as string
    const userId = (payload.userId || payload.user?.id) as string

    if (messageId && emoji && userId) {
      messageStore.removeReaction(messageId, emoji, userId)
    }
  }

  // Handle typing events
  if (message.type === 'typing_start') {
    const payload = (message.payload || {}) as Record<string, any>
    const userId = payload.userId as string
    const username = (payload.username || 'User') as string
    const channelId = (payload.channelId || message.channelId) as string

    if (userId && channelId) {
      const current = typingUsers[channelId] || []
      if (!current.some((u) => u.userId === userId)) {
        useWebSocketStore.setState({
          typingUsers: {
            ...typingUsers,
            [channelId]: [...current, { userId, username }],
          },
        })
      }
    }
  }

  if (message.type === 'typing_stop') {
    const payload = (message.payload || {}) as Record<string, any>
    const userId = payload.userId as string
    const channelId = (payload.channelId || message.channelId) as string

    if (userId && channelId) {
      const current = typingUsers[channelId] || []
      useWebSocketStore.setState({
        typingUsers: {
          ...typingUsers,
          [channelId]: current.filter((u) => u.userId !== userId),
        },
      })
    }
  }

  // Handle Voice room state and participant updates
  if (message.type === 'voice_room_state') {
    const payload = (message.payload || {}) as {
      channelId?: string
      participants?: Array<{
        user_id?: string
        userId?: string
        username?: string
        display_name?: string
        displayName?: string
        self_muted?: boolean
        selfMuted?: boolean
        muted?: boolean
        deafened?: boolean
        is_screen_sharing?: boolean
        isScreenSharing?: boolean
        joined_at?: string
      }>
    }
    const channelId = (payload.channelId || message.channelId) as string
    const participants = payload.participants || []
    const voiceStore = useVoiceStore.getState()
    const newMap = new Map(voiceStore.participants)

    participants.forEach((p) => {
      const uid = p.user_id || p.userId
      if (uid) {
        newMap.set(uid, {
          channelId,
          muted: Boolean(p.self_muted ?? p.selfMuted ?? p.muted),
          deafened: Boolean(p.deafened),
          isScreenSharing: Boolean(p.is_screen_sharing ?? p.isScreenSharing),
          joinedAt: p.joined_at ? new Date(p.joined_at).getTime() : Date.now(),
          localMuted: false,
          volume: 1.0,
          isSpeaking: false,
          username: p.username,
          displayName: p.display_name || p.displayName,
        })
      }
    })
    voiceStore.setParticipants(newMap)
  }

  if (message.type === 'user_joined_voice') {
    const payload = (message.payload || {}) as {
      channelId?: string
      user?: Record<string, any>
    }
    const user = (payload.user || payload) as Record<string, any>
    const uid = user.user_id || user.userId
    const channelId = (payload.channelId || message.channelId || user.channelId) as string
    if (uid) {
      useVoiceStore.getState().addParticipant(uid, {
        channelId,
        muted: Boolean(user.self_muted ?? user.selfMuted ?? user.muted),
        deafened: Boolean(user.deafened),
        isScreenSharing: Boolean(user.is_screen_sharing ?? user.isScreenSharing),
        joinedAt: user.joined_at ? new Date(user.joined_at).getTime() : Date.now(),
        localMuted: false,
        volume: 1.0,
        isSpeaking: false,
        username: user.username,
        displayName: user.display_name || user.displayName,
      })
    }
  }

  if (message.type === 'user_left_voice') {
    const payload = (message.payload || {}) as { channelId?: string; userId?: string }
    const uid = payload.userId
    if (uid) {
      useVoiceStore.getState().removeParticipant(uid)
    }
  }

  if (message.type === 'voice_state_update') {
    const payload = (message.payload || {}) as {
      userId?: string
      selfMuted?: boolean
      selfDeafened?: boolean
    }
    if (payload.userId) {
      useVoiceStore.getState().updateParticipant(payload.userId, {
        muted: Boolean(payload.selfMuted),
        deafened: Boolean(payload.selfDeafened),
      })
    }
  }

  if (message.type === 'speaking') {
    const payload = (message.payload || {}) as { userId?: string; speaking?: boolean }
    if (payload.userId) {
      useVoiceStore.getState().setParticipantSpeaking(payload.userId, Boolean(payload.speaking))
    }
  }
}

// Helper to get token (avoid circular dependency)
let getTokenFromStore: () => string | null = () => null
export const setTokenGetter = (getter: () => string | null) => {
  getTokenFromStore = getter
}

// Selectors
export const useIsConnected = () => useWebSocketStore((s) => s.isConnected)

// Stable selector for typing users using shallow comparison
export const useTypingUsers = (channelId: string): TypingUser[] => {
  return useWebSocketStore(
    useShallow((s) => s.typingUsers[channelId] || [])
  )
}

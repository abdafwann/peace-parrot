import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

export type WSEventType =
  | 'message'
  | 'message_edit'
  | 'message_delete'
  | 'reaction_add'
  | 'reaction_remove'
  | 'typing_start'
  | 'typing_stop'
  | 'user_online'
  | 'user_offline'
  | 'voice_join'
  | 'voice_leave'
  | 'voice_state_update'
  | 'speaking'

export interface WSMessage {
  type: WSEventType
  channelId?: string
  payload: Record<string, unknown>
}

interface WebSocketState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  socket: WebSocket | null

  // Typing state
  typingUsers: Record<string, string[]> // channelId -> userIds

  // Message handlers
  messageHandlers: Set<(message: WSMessage) => void>

  // Actions
  connect: (token: string) => void
  disconnect: () => void
  send: (message: WSMessage) => void
  subscribe: (handler: (message: WSMessage) => void) => () => void

  // Typing actions
  startTyping: (channelId: string) => void
  stopTyping: (channelId: string) => void
}

const WS_URL = 'ws://localhost:8080/ws'
const RECONNECT_DELAY = 3000

export const useWebSocketStore = create<WebSocketState>()(
  devtools(
    (set, get) => ({
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

        try {
          const ws = new WebSocket(`${WS_URL}?token=${token}`)

          ws.onopen = () => {
            console.log('[WS] Connected')
            set({ isConnected: true, isConnecting: false, socket: ws, error: null })
          }

          ws.onclose = (event) => {
            console.log('[WS] Disconnected', event.code, event.reason)
            set({ isConnected: false, isConnecting: false, socket: null })

            // Don't reconnect if:
            // - Manually closed (code 1000)
            // - Connection refused (code 1006 usually)
            // - Server not available
            if (event.code !== 1000 && event.code !== 1006) {
              console.log('[WS] Reconnecting in', RECONNECT_DELAY, 'ms')
              setTimeout(() => {
                const token = getTokenFromStore()
                if (token) get().connect(token)
              }, RECONNECT_DELAY)
            } else {
              console.log('[WS] Not reconnecting - connection was closed or refused')
            }
          }

          ws.onerror = (error) => {
            console.error('[WS] Error:', error)
            // Don't set error here to avoid repeated reconnect attempts
            // The onclose handler will deal with it
          }

          ws.onmessage = (event) => {
            try {
              const message: WSMessage = JSON.parse(event.data)
              handleMessage(message)
            } catch (err) {
              console.error('[WS] Failed to parse message:', err)
            }
          }

          set({ socket: ws })
        } catch (err) {
          console.error('[WS] Connection failed:', err)
          set({ isConnecting: false, error: 'Failed to connect to server' })
        }
      },

      disconnect: () => {
        const { socket } = get()
        if (socket) {
          socket.close(1000, 'User disconnected')
          set({ socket: null, isConnected: false, isConnecting: false })
        }
      },

      send: (message: WSMessage) => {
        const { socket } = get()
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message))
        } else {
          console.warn('[WS] Cannot send, not connected')
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
        get().send({
          type: 'typing_start',
          channelId,
          payload: {},
        })
      },

      stopTyping: (channelId: string) => {
        get().send({
          type: 'typing_stop',
          channelId,
          payload: {},
        })
      },
    }),
    { name: 'WebSocketStore' }
  )
)

// Helper to handle incoming messages
function handleMessage(message: WSMessage) {
  const { messageHandlers, typingUsers } = useWebSocketStore.getState()

  // Notify all handlers
  messageHandlers.forEach((handler) => handler(message))

  // Handle typing events
  if (message.type === 'typing_start') {
    const { userId, channelId } = message.payload as { userId: string; channelId: string }
    if (userId && channelId) {
      const current = typingUsers[channelId] || []
      if (!current.includes(userId)) {
        useWebSocketStore.setState({
          typingUsers: {
            ...typingUsers,
            [channelId]: [...current, userId],
          },
        })
      }
    }
  }

  if (message.type === 'typing_stop') {
    const { userId, channelId } = message.payload as { userId: string; channelId: string }
    if (userId && channelId) {
      const current = typingUsers[channelId] || []
      useWebSocketStore.setState({
        typingUsers: {
          ...typingUsers,
          [channelId]: current.filter((id) => id !== userId),
        },
      })
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
export const useTypingUsers = (channelId: string): string[] => {
  return useWebSocketStore(
    useShallow((s) => s.typingUsers[channelId] || [])
  )
}

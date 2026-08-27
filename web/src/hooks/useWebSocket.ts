import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '../stores/authStore'

export type WSEventType =
  | 'message'
  | 'message_edit'
  | 'message_delete'
  | 'reaction_add'
  | 'reaction_remove'
  | 'typing'
  | 'typing_stop'
  | 'voice_join'
  | 'voice_leave'
  | 'voice_state_update'
  | 'speaking'

export interface WSMessage {
  type: WSEventType
  channelId?: string
  payload: Record<string, unknown>
}

type MessageHandler = (message: WSMessage) => void

export function useWebSocket(url: string, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [isConnected, setIsConnected] = useState(false)
  const token = useAuthStore((state) => state.token)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = `${url}?token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[WS] Connected')
      setIsConnected(true)
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setIsConnected(false)
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        onMessage(message)
      } catch (err) {
        console.error('[WS] Failed to parse message:', err)
      }
    }

    wsRef.current = ws
  }, [url, token, onMessage])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('[WS] Cannot send, not connected')
    }
  }, [])

  useEffect(() => {
    if (token) {
      connect()
    }
    return () => disconnect()
  }, [connect, disconnect, token])

  return { isConnected, send, disconnect, connect }
}

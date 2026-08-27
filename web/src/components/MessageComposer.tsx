import { useState, useRef, useEffect, useCallback } from 'react'
import { useChannelStore } from '../stores/channelStore'
import { useWebSocketStore } from '../stores/websocketStore'
import { Send, Paperclip, Smile, AtSign } from 'lucide-react'

export function MessageComposer() {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const activeChannelId = useChannelStore((s) => s.activeChannelId)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  const send = useWebSocketStore((s) => s.send)
  const startTyping = useWebSocketStore((s) => s.startTyping)
  const stopTyping = useWebSocketStore((s) => s.stopTyping)

  const handleStopTyping = useCallback(() => {
    if (isTypingRef.current && activeChannelId) {
      stopTyping(activeChannelId)
      isTypingRef.current = false
    }
  }, [activeChannelId, stopTyping])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)

    if (value.trim() && activeChannelId) {
      if (!isTypingRef.current) {
        startTyping(activeChannelId)
        isTypingRef.current = true
      }

      // Reset typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingTimeoutRef.current = setTimeout(() => {
        handleStopTyping()
      }, 3000)
    } else {
      handleStopTyping()
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!message.trim() || !activeChannelId || sending) return

    // Stop typing indicator
    handleStopTyping()

    setSending(true)
    const messageToSend = message.trim()
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setMessage('')

    // Send via WebSocket per spec
    send({
      type: 'message',
      channelId: activeChannelId,
      payload: {
        channelId: activeChannelId,
        id: tempId,
        content: messageToSend,
      },
    })

    // Clear sending state (real message will come back via WebSocket)
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      handleStopTyping()
    }
  }, [handleStopTyping])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px'
    }
  }, [message])

  if (!activeChannelId) {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-4 pt-1">
      <div
        className="rounded-xl flex items-end gap-2 p-2 transition-all duration-200"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-default)' }}
      >
        {/* Left actions */}
        <div className="flex items-center gap-0.5 pl-1">
          <button
            type="button"
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-all duration-150"
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
        </div>

        {/* Input area */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message #channel"
            rows={1}
            className="w-full bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none py-2 px-1 max-h-[200px]"
            style={{ minHeight: '40px' }}
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 pr-1">
          <button
            type="button"
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-all duration-150"
            title="Emoji picker"
          >
            <Smile size={20} />
          </button>

          <button
            type="button"
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-all duration-150"
            title="Mention someone"
          >
            <AtSign size={20} />
          </button>

          <div className="w-px h-6 bg-[var(--color-border-default)] mx-1" />

          <button
            type="submit"
            disabled={!message.trim() || sending}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${message.trim()
                ? 'text-[var(--color-brand)] hover:bg-[var(--color-brand-subtle)] shadow-sm hover:shadow-md'
                : 'text-[var(--color-text-muted)] cursor-not-allowed'
              }
            `}
            title="Send message"
          >
            <Send size={20} className={sending ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>

      {/* Hints */}
      <div className="flex items-center gap-4 mt-2 px-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'var(--color-bg-tertiary)' }}>
            Enter
          </kbd>{' '}
          to send
        </p>
      </div>
    </form>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChannelStore } from '../stores/channelStore'
import { useWebSocketStore } from '../stores/websocketStore'
import { useAuthStore } from '../stores/authStore'
import { toast } from '../stores/toastStore'
import { apiFetch } from '../utils/config'
import {
  Send,
  Paperclip,
  Smile,
  X,
  FileText,
  UploadCloud,
  Loader2,
} from 'lucide-react'

export interface Attachment {
  id: string
  url: string
  filename: string
  size: number
  type: string
  mimeType: string
}

export function MessageComposer() {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const activeChannelId = useChannelStore((s) => s.activeChannelId)
  const channels = useChannelStore((s) => s.channels)
  const activeChannel = channels.find((c) => c.id === activeChannelId)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const dragCounterRef = useRef(0)

  const send = useWebSocketStore((s) => s.send)
  const startTyping = useWebSocketStore((s) => s.startTyping)
  const stopTyping = useWebSocketStore((s) => s.stopTyping)
  const token = useAuthStore((s) => s.token)

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

  // Upload files handler
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return
    const fileList = Array.from(files)

    for (const file of fileList) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 10 MB Discord-standard upload limit.`)
        continue
      }

      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await apiFetch('/api/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          toast.error(errData.error || 'Failed to upload attachment')
          continue
        }

        const data: Attachment = await res.json()
        setAttachments((prev) => [...prev, data])
      } catch (err: any) {
        toast.error(err.message || 'Error uploading file')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUploadFiles(e.target.files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if ((!message.trim() && attachments.length === 0) || !activeChannelId || sending || isUploading) {
      return
    }

    handleStopTyping()
    setSending(true)
    const messageToSend = message.trim()
    const currentAttachments = [...attachments]
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

    setMessage('')
    setAttachments([])

    const wsConnected = useWebSocketStore.getState().isConnected

    if (wsConnected) {
      // Send message via WebSocket
      send({
        type: 'message',
        channelId: activeChannelId,
        payload: {
          channelId: activeChannelId,
          id: tempId,
          content: messageToSend,
          attachments: currentAttachments,
        },
      })
    } else {
      // Fallback only if WebSocket is disconnected
      try {
        await apiFetch(`/api/channels/${activeChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content: messageToSend,
            attachments: currentAttachments,
          }),
        })
      } catch (err: any) {
        toast.error(err.message || 'Failed to send message')
      }
    }

    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      setIsDragging(false)
      dragCounterRef.current = 0
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  // Quick emojis
  const QUICK_EMOJIS = ['😀', '😂', '🔥', '🦜', '❤️', '👍', '🎉', '🚀', '✨', '👀', '💯', '👏']

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

  if (!activeChannelId) return null

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 pb-4 pt-1 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-x-4 top-1 bottom-4 z-50 rounded-2xl bg-[var(--color-brand)]/20 border-2 border-dashed border-[var(--color-brand)] backdrop-blur-md flex flex-col items-center justify-center pointer-events-none animate-fade-in">
          <UploadCloud size={40} className="text-[var(--color-brand)] mb-2 animate-bounce" />
          <span className="text-sm font-bold text-white">Drop files to upload</span>
          <span className="text-xs text-white/70">Images, videos, audio, or files up to 10 MB</span>
        </div>
      )}

      {/* Main Composer Box */}
      <div
        className="rounded-2xl flex flex-col p-2 transition-all duration-200 shadow-md"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        {/* Pending Attachments Strip */}
        {(attachments.length > 0 || isUploading) && (
          <div className="flex flex-wrap items-center gap-2.5 p-2 pb-3 mb-1 border-b border-[var(--color-border-default)]">
            {attachments.map((att) => {
              const isImg = att.type === 'image' || att.mimeType.startsWith('image/')
              return (
                <div
                  key={att.id}
                  className="relative group flex items-center gap-2.5 p-2 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] max-w-[240px] animate-fade-in-scale"
                >
                  {isImg ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/20">
                      <img src={att.url} alt={att.filename} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-brand)]/20 text-[var(--color-brand)] flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {att.filename}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {(att.size / 1024).toFixed(0)} KB
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            })}

            {isUploading && (
              <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-xs text-[var(--color-text-secondary)] animate-pulse">
                <Loader2 size={16} className="animate-spin text-[var(--color-brand)]" />
                <span>Uploading...</span>
              </div>
            )}
          </div>
        )}

        {/* Input & Action Bar */}
        <div className="flex items-end gap-2">
          {/* File Picker Button */}
          <div className="flex items-center pl-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer"
              title="Attach media or file (Max 10 MB)"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${activeChannel?.name || 'channel'}`}
              rows={1}
              className="w-full bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none focus:outline-none py-2 px-1 max-h-[200px] text-sm"
              style={{ minHeight: '40px' }}
            />
          </div>

          {/* Quick Emoji Trigger & Picker Popover */}
          <div className="relative flex items-center pr-1">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                showEmojiPicker
                  ? 'text-[var(--color-brand)] bg-[var(--color-brand)]/15'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
              title="Emoji picker"
            >
              <Smile size={18} />
            </button>

            {/* Quick Emoji Menu */}
            {showEmojiPicker && (
              <div
                className="absolute bottom-12 right-0 z-50 p-2.5 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-2xl flex flex-wrap gap-1.5 w-52 animate-fade-in-scale"
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setMessage((prev) => prev + emoji)
                      setShowEmojiPicker(false)
                      inputRef.current?.focus()
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-[var(--color-bg-hover)] text-lg flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="w-px h-5 bg-[var(--color-border-default)] mx-1" />

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!message.trim() && attachments.length === 0) || sending || isUploading}
              className={`
                p-2 rounded-xl transition-all duration-200
                ${
                  message.trim() || attachments.length > 0
                    ? 'bg-[var(--color-brand)] text-white hover:opacity-90 shadow-md cursor-pointer'
                    : 'text-[var(--color-text-muted)] opacity-50 cursor-not-allowed'
                }
              `}
              title="Send message (Enter)"
            >
              <Send size={16} className={sending ? 'animate-pulse' : ''} />
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

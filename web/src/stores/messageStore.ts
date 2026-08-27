import { create } from 'zustand'

export interface Message {
  id: string
  channelId: string
  authorId: string
  content: string
  createdAt: string
  editedAt?: string
  deletedAt?: string
}

export interface Reaction {
  emoji: string
  count: number
  users: { id: string; username: string }[]
}

interface MessageState {
  // Messages by channel ID
  messages: Map<string, Message[]>

  // Pending (optimistic) messages
  pending: Map<string, Message[]>

  // Failed messages
  failed: Map<string, Message[]>

  // Typing users by channel ID
  typingUsers: Map<string, Set<string>>

  // Reactions by message ID
  reactions: Map<string, Reaction[]>

  // Actions
  setMessages: (channelId: string, messages: Message[]) => void
  addMessage: (channelId: string, message: Message) => void
  updateMessage: (channelId: string, messageId: string, content: string) => void
  removeMessage: (channelId: string, messageId: string) => void

  // Pending messages
  addPendingMessage: (channelId: string, message: Message) => void
  confirmPendingMessage: (tempId: string, realId: string, channelId: string) => void
  moveToFailed: (tempId: string, channelId: string) => void
  retryMessage: (tempId: string, channelId: string) => void

  // Typing indicators
  setTyping: (channelId: string, userId: string, isTyping: boolean) => void

  // Reactions
  setReactions: (messageId: string, reactions: Reaction[]) => void
  addReaction: (messageId: string, emoji: string, user: { id: string; username: string }) => void
  removeReaction: (messageId: string, emoji: string, userId: string) => void
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: new Map(),
  pending: new Map(),
  failed: new Map(),
  typingUsers: new Map(),
  reactions: new Map(),

  setMessages: (channelId, messages) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      newMessages.set(channelId, messages)
      return { messages: newMessages }
    }),

  addMessage: (channelId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const channelMessages = newMessages.get(channelId) ?? []
      newMessages.set(channelId, [...channelMessages, message])
      return { messages: newMessages }
    }),

  updateMessage: (channelId, messageId, content) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const channelMessages = newMessages.get(channelId) ?? []
      newMessages.set(
        channelId,
        channelMessages.map((m) =>
          m.id === messageId ? { ...m, content, editedAt: new Date().toISOString() } : m
        )
      )
      return { messages: newMessages }
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const newMessages = new Map(state.messages)
      const channelMessages = newMessages.get(channelId) ?? []
      newMessages.set(
        channelId,
        channelMessages.map((m) =>
          m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m
        )
      )
      return { messages: newMessages }
    }),

  addPendingMessage: (channelId, message) =>
    set((state) => {
      const newPending = new Map(state.pending)
      const pendingMessages = newPending.get(channelId) ?? []
      newPending.set(channelId, [...pendingMessages, message])
      return { pending: newPending }
    }),

  confirmPendingMessage: (tempId, realId, channelId) =>
    set((state) => {
      // Move from pending to confirmed messages
      const newPending = new Map(state.pending)
      const newMessages = new Map(state.messages)

      const pendingMessages = newPending.get(channelId) ?? []
      const confirmed = pendingMessages.find((m) => m.id === tempId)

      if (confirmed) {
        const channelMessages = newMessages.get(channelId) ?? []
        newPending.set(
          channelId,
          pendingMessages.filter((m) => m.id !== tempId)
        )
        newMessages.set(channelId, [
          ...channelMessages.filter((m) => m.id !== tempId),
          { ...confirmed, id: realId },
        ])
      }

      return { pending: newPending, messages: newMessages }
    }),

  moveToFailed: (tempId, channelId) =>
    set((state) => {
      const newPending = new Map(state.pending)
      const newFailed = new Map(state.failed)

      const pendingMessages = newPending.get(channelId) ?? []
      const failedMessages = newFailed.get(channelId) ?? []

      const failed = pendingMessages.find((m) => m.id === tempId)
      if (failed) {
        newPending.set(
          channelId,
          pendingMessages.filter((m) => m.id !== tempId)
        )
        newFailed.set(channelId, [...failedMessages, failed])
      }

      return { pending: newPending, failed: newFailed }
    }),

  retryMessage: (tempId, channelId) =>
    set((state) => {
      const newFailed = new Map(state.failed)
      const newPending = new Map(state.pending)

      const failedMessages = newFailed.get(channelId) ?? []
      const pendingMessages = newPending.get(channelId) ?? []

      const toRetry = failedMessages.find((m) => m.id === tempId)
      if (toRetry) {
        newFailed.set(
          channelId,
          failedMessages.filter((m) => m.id !== tempId)
        )
        newPending.set(channelId, [...pendingMessages, toRetry])
      }

      return { failed: newFailed, pending: newPending }
    }),

  setTyping: (channelId, userId, isTyping) =>
    set((state) => {
      const newTyping = new Map(state.typingUsers)
      const channelTyping = newTyping.get(channelId) ?? new Set<string>()

      if (isTyping) {
        channelTyping.add(userId)
      } else {
        channelTyping.delete(userId)
      }

      newTyping.set(channelId, channelTyping)
      return { typingUsers: newTyping }
    }),

  setReactions: (messageId, reactions) =>
    set((state) => {
      const newReactions = new Map(state.reactions)
      newReactions.set(messageId, reactions)
      return { reactions: newReactions }
    }),

  addReaction: (messageId, emoji, user) =>
    set((state) => {
      const newReactions = new Map(state.reactions)
      const messageReactions = newReactions.get(messageId) ?? []

      const existing = messageReactions.find((r) => r.emoji === emoji)
      if (existing) {
        newReactions.set(
          messageId,
          messageReactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, users: [...r.users, user] }
              : r
          )
        )
      } else {
        newReactions.set(messageId, [
          ...messageReactions,
          { emoji, count: 1, users: [user] },
        ])
      }

      return { reactions: newReactions }
    }),

  removeReaction: (messageId, emoji, userId) =>
    set((state) => {
      const newReactions = new Map(state.reactions)
      const messageReactions = newReactions.get(messageId) ?? []

      newReactions.set(
        messageId,
        messageReactions
          .map((r) =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: r.count - 1,
                  users: r.users.filter((u) => u.id !== userId),
                }
              : r
          )
          .filter((r) => r.count > 0)
      )

      return { reactions: newReactions }
    }),
}))

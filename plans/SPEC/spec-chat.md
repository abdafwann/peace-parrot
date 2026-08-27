# PeaceParrot — Chat System Spec

**Parent:** peace-parrot-prd.md
**Status:** Finalized
**Date:** 2025-08-25

---

## 1. Overview

This spec covers the **text messaging system** — real-time chat in channels, message history, and related features.

---

## 2. Features

### 2.1 Core Messaging

| Feature | Status | Notes |
|---------|--------|-------|
| Send/receive messages | ✅ | Real-time via WebSocket |
| Message history | ✅ | SQLite, paginated |
| Timestamps | ✅ | "Today at 3:42 PM" / "Aug 25 at 3:42 PM" |
| Message limit | 4000 chars | Hard limit |
| Message editing | ✅ | Shows "edited" badge, explicit save only |
| Message deletion | ✅ | Soft delete, shows "[deleted]" |

### 2.2 Real-time Features

| Feature | Status | Notes |
|---------|--------|-------|
| Typing indicators | ✅ | "Afwan is typing..." for 3s, channel-scoped only |
| Link previews | ✅ | Max 3 previews per message |
| Reactions | ✅ | Unicode emoji, toggle add/remove |

### 2.3 Organization

| Feature | Status | Notes |
|---------|--------|-------|
| Message search | ✅ | Full-text search |
| Pin messages | ✅ | Max 50 per channel |
| Unread indicators | ✅ | Badge on channels |

---

## 3. Decisions

### 3.1 Message Delivery

**Chosen: Optimistic UI + Retry**

- Message appears immediately in chat (optimistic)
- Sent to server in background
- On failure: show error state (red indicator / retry button)
- Client retries automatically 2-3 times before showing error

### 3.2 Link Previews

**Chosen: Max 3 per message**

- First 3 URLs in message get previews
- Fetch OpenGraph metadata server-side (or client-side)
- Don't slow down message send with too many fetches

### 3.3 Reactions

**Chosen: Toggle behavior**

- Click emoji → add reaction
- Click same emoji again → remove reaction
- One reaction per user per emoji per message
- Multiple different emojis per message allowed
- No max limit per message

### 3.4 Typing Indicators

**Chosen: Channel-scoped, no badge**

- Only visible when viewing the specific channel
- No badge on channels where someone is typing
- Disappears after 3s of inactivity

### 3.5 Unread Logic

**Chosen: Context-aware unread**

Channel marked unread when ALL conditions met:

1. New message arrives
2. Sender is NOT the current user
3. User is NOT actively viewing that channel:
   - Viewing a different channel
   - App minimized
   - Window unfocused
   - Scrolled up (reading old history)

Channel marked read when:
- User views the channel AND scrolls to bottom (sees latest message)
- User explicitly marks as read

### 3.6 Message Editing

**Chosen: Explicit save only**

- No auto-save draft
- User clicks "Save" to confirm edit
- Edits broadcast to all clients immediately
- Shows "edited" badge on message

### 3.7 Pagination

**Chosen: Cursor-based + Infinite scroll + Load more button**

- Backend: cursor-based pagination (efficient, stable on inserts)
- Frontend: infinite scroll up
- Fallback: "Load more" button
- Default load: 50 messages per request

---

## 4. Data Model

### Message Entity

```go
type Message struct {
    ID          string    `json:"id"`           // UUID
    ChannelID   string    `json:"channel_id"`    // FK to channel
    AuthorID    string    `json:"author_id"`    // FK to user
    Content     string    `json:"content"`       // max 4000 chars
    CreatedAt   time.Time `json:"created_at"`
    EditedAt    *time.Time `json:"edited_at"`   // nullable
    DeletedAt   *time.Time `json:"deleted_at"`   // nullable (soft delete)
}
```

### Reaction Entity

```go
type Reaction struct {
    ID        string    `json:"id"`
    MessageID string    `json:"message_id"`     // FK to message
    UserID    string    `json:"user_id"`       // FK to user
    Emoji     string    `json:"emoji"`         // Unicode emoji
    CreatedAt time.Time `json:"created_at"`
}
```

### Pagination Cursor

```go
type MessageCursor struct {
    BeforeID  string    `json:"before_id"`  // load messages before this ID
    Limit     int       `json:"limit"`       // default 50
}
```

---

## 5. API Design

### REST Endpoints

```
GET    /api/channels/:id/messages     — Paginated message history
POST   /api/channels/:id/messages     — Send message
PATCH  /api/messages/:id               — Edit message
DELETE /api/messages/:id              — Delete message
GET    /api/messages/search           — Search messages
POST   /api/messages/:id/reactions    — Add reaction
DELETE /api/messages/:id/reactions/:emoji — Remove reaction
GET    /api/channels/:id/pins         — List pinned messages
POST   /api/channels/:id/pins/:messageId — Pin message
DELETE /api/channels/:id/pins/:messageId — Unpin message
```

### WebSocket Events

```
Client → Server
{ type: "subscribe", channelId: "xxx" }
{ type: "unsubscribe", channelId: "xxx" }
{ type: "typing_start", channelId: "xxx" }
{ type: "typing_stop", channelId: "xxx" }

Server → Client
{ type: "message", channelId: "xxx", message: {...} }
{ type: "message_edit", channelId: "xxx", message: {...} }
{ type: "message_delete", channelId: "xxx", messageId: "yyy" }
{ type: "reaction_add", channelId: "xxx", messageId: "yyy", emoji: "👍", userId: "zzz" }
{ type: "reaction_remove", ... }
{ type: "typing", channelId: "xxx", userId: "zzz", username: "Afwan" }
{ type: "channel_unread", channelId: "xxx", unreadCount: 5 }
```

---

## 6. Frontend Architecture

### Zustand Store (useMessageStore)

```typescript
interface MessageState {
  // Per-channel messages
  messages: Map<channelId, Message[]>

  // Pending messages (optimistic)
  pendingMessages: Map<temporaryId, Message>

  // Failed messages
  failedMessages: Map<temporaryId, Message>

  // Typing users per channel
  typingUsers: Map<channelId, Set<userId>>

  // Actions
  addMessage: (channelId: string, message: Message) => void
  updateMessage: (channelId: string, messageId: string, content: string) => void
  deleteMessage: (channelId: string, messageId: string) => void
  addReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void
  removeReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void
  setTyping: (channelId: string, userId: string, isTyping: boolean) => void
  markPending: (tempId: string, message: Message) => void
  markFailed: (tempId: string, message: Message) => void
  confirmSent: (tempId: string, realId: string, channelId: string) => void
  retryMessage: (tempId: string) => void
}
```

### Optimistic Send Flow

```
1. User types message, presses Enter
   └── Generate tempId (uuid)
   └── Add to pendingMessages
   └── Render immediately in chat

2. Send to server via WebSocket
   └── { type: "message", channelId, tempId, content }

3. Server broadcasts to all clients (including sender)
   └── { type: "message", channelId, message: {...}, ackTempId: tempId }

4. Client confirms:
   └── Remove from pendingMessages
   └── Add to messages with real ID

5. On failure (timeout 5s):
   └── Move to failedMessages
   └── Show error indicator
   └── Retry button available
```

### Typing Indicator Flow

```
1. User starts typing
   └── Debounce 300ms
   └── Send typing_start

2. Server broadcasts to channel
   └── All clients show "X is typing"

3. User stops typing (3s no keystroke)
   └── Send typing_stop
   └── OR auto-stop after 5s max

4. On message send
   └── Clear typing indicators for that user
```

---

## 7. Link Preview

### Flow

```
1. Message sent: "Check https://example.com and https://youtube.com"
2. Backend extracts URLs (max 3)
3. Fetch OpenGraph for each URL
4. Return previews with message

type LinkPreview struct {
    URL         string `json:"url"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Image       string `json:"image"`
    SiteName    string `json:"site_name"`
}
```

### Caching

- Cache link previews in Redis/memory for 1 hour
- Don't re-fetch for same URL

---

## 8. TBD

None — all decisions finalized.

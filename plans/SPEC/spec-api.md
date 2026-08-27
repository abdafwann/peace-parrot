# PeaceParrot — API Design Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec documents all API endpoints and WebSocket protocol.

---

## 2. REST Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account (requires invite code) |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `POST` | `/api/auth/logout` | Invalidate session |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/me` | Current user profile |
| `PATCH` | `/api/users/me` | Update profile (display name, bio, avatar) |
| `PATCH` | `/api/users/me/status` | Update status (online/away/dnd/invisible) |
| `GET` | `/api/users/:id` | Get user profile |
| `GET` | `/api/users/:id/status` | Get user status |

### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/channels` | List all channels |
| `POST` | `/api/channels` | Create channel (admin/mod) |
| `PATCH` | `/api/channels/:id` | Edit channel (admin/mod) |
| `DELETE` | `/api/channels/:id` | Delete channel (admin) |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/channels/:id/messages` | Paginated message history |
| `POST` | `/api/channels/:id/messages` | Send message |
| `PATCH` | `/api/messages/:id` | Edit message |
| `DELETE` | `/api/messages/:id` | Delete message |
| `GET` | `/api/messages/search` | Search messages |

### Reactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/messages/:id/reactions` | Add reaction |
| `DELETE` | `/api/messages/:id/reactions/:emoji` | Remove reaction |

### Pins

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/channels/:id/pins/:messageId` | Pin message |
| `DELETE` | `/api/channels/:id/pins/:messageId` | Unpin message |
| `GET` | `/api/channels/:id/pins` | List pinned messages |

### Voice

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/voice/mute/:userId` | Server mute user (moderation) |
| `DELETE` | `/api/voice/mute/:userId` | Unmute user |

*Note: Voice join/leave is handled exclusively via WebSocket events.*

### Invites

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/invites` | Generate invite (admin/mod) |
| `GET` | `/api/invites` | List active invites (admin) |
| `DELETE` | `/api/invites/:id` | Revoke invite |

### Moderation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/moderation/kick/:userId` | Kick user |
| `POST` | `/api/moderation/ban/:userId` | Ban user |
| `POST` | `/api/moderation/mute/:userId` | Mute user (text) |
| `DELETE` | `/api/moderation/mute/:userId` | Unmute user |

---

## 3. WebSocket Protocol

### 3.1 Message Envelope

WebSocket does not guarantee message ordering under packet loss. Use sequence numbers for reliable delivery.

```go
// All messages wrapped in this envelope
type WSMessage struct {
    Seq     uint64  `json:"seq"`
    Type    string  `json:"type"`
    Payload any     `json:"payload"`
}

// Server-side monotonic counter per connection
type ServerMessage struct {
    Seq     uint64  `json:"seq"`
    Type    string  `json:"type"`
    Payload any     `json:"payload"`
}

// Client sends its own sequence number
type ClientMessage struct {
    Seq     uint64  `json:"seq"`
    Type    string  `json:"type"`
    Payload any     `json:"payload"`
}
```

### 3.2 Ordering Rules

| Rule          | Implementation                                           |
| ------------- | -------------------------------------------------------- |
| Monotonic Seq | Server increments counter per message, never rewinds     |
| Gap detection | If Seq gap detected → request resend from last known Seq |
| Acknowledge   | Server echoes client Seq back on processing              |
| Resend        | Client resends from last acked Seq on gap                |

### 3.3 Client-Side Resend Logic

```
1. Client sends: { seq: 5, type: "message", payload: {...} }
2. Server: processes, broadcasts to others, echoes { seq: 10, ack: 5 }
3. Client: receives ack 5, marks Seq 5 as delivered
4. If gap detected (expect 6, get 8):
   └── Request resend: { type: "resend", fromSeq: 6 }
   └── Server resends messages 6, 7
```

---

## 4. WebSocket Events

### 4.1 Chat Events

```
Client → Server
{ type: "subscribe", channelId: "channel_123" }
{ type: "unsubscribe", channelId: "channel_123" }
{ type: "typing_start", channelId: "channel_123" }
{ type: "typing_stop", channelId: "channel_123" }

Server → Client
{ type: "message", channelId: "channel_123", message: {...} }
{ type: "message_edit", channelId: "channel_123", message: {...} }
{ type: "message_delete", channelId: "channel_123", messageId: "msg_789" }
{ type: "reaction_add", channelId: "channel_123", messageId: "msg_789", emoji: "👍", userId: "user_456" }
{ type: "reaction_remove", ... }
{ type: "typing", channelId: "channel_123", userId: "user_456", username: "Afwan" }
{ type: "channel_unread", channelId: "channel_123", unreadCount: 5 }
```

### 4.2 Presence Events

```
Server → Client
{ type: "user_status", userId: "user_456", status: "away" }
{ type: "presence", users: [{ id, status, lastSeen }] }
```

### 4.3 Voice Events

*See `../SPEC/spec-voice.md` for full voice WebSocket events.*

```
Client → Server
{ type: "voice_join", channelId: "channel_123" }
{ type: "voice_leave", channelId: "channel_123" }
{ type: "voice_state_update", channelId: "channel_123", selfMuted: true, selfDeafened: false }
{ type: "speaking", channelId: "channel_123", speaking: true }
{ type: "webrtc_offer", sdp: "..." }
{ type: "webrtc_answer", sdp: "..." }
{ type: "webrtc_ice", candidate: "...", sdpMid: "...", sdpMLineIndex: 0 }

Server → Client
{ type: "user_joined_voice", channelId: "channel_123", user: {...} }
{ type: "user_left_voice", channelId: "channel_123", userId: "user_456" }
{ type: "voice_room_state", channelId: "channel_123", participants: [...] }
{ type: "voice_state_update", channelId: "channel_123", userId: "user_456", selfMuted: true, selfDeafened: false }
{ type: "user_muted", channelId: "channel_123", userId: "user_456", muted: true }
{ type: "speaking", channelId: "channel_123", userId: "user_456", speaking: true }
{ type: "webrtc_offer", sdp: "..." }
{ type: "webrtc_answer", sdp: "..." }
{ type: "webrtc_ice", candidate: "...", sdpMid: "...", sdpMLineIndex: 0 }
```

---

## 5. TBD

None — all decisions finalized.

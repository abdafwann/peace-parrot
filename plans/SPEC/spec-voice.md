# PeaceParrot — Voice System Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec covers the **voice system** — real-time voice communication via SFU, screen sharing, and related features.

**Architecture:** SFU-based via pion/sfu, built into Go server.

---

## 2. API Design

### 2.1 WebSocket Events (Single Source of Truth)

Voice state is managed entirely via WebSocket. REST is used only for persistent moderation actions.

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `voice_join` | `{ channelId: string }` | Join voice channel |
| `voice_leave` | `{ channelId: string }` | Leave voice channel |
| `voice_state_update` | `{ channelId: string, selfMuted: boolean, selfDeafened: boolean }` | Toggle self mute/deafen |
| `speaking` | `{ channelId: string, speaking: boolean }` | Speaking indicator |
| `webrtc_offer` | `{ sdp: string }` | WebRTC offer to SFU |
| `webrtc_answer` | `{ sdp: string }` | WebRTC answer to SFU |
| `webrtc_ice` | `{ candidate: string, sdpMid: string, sdpMLineIndex: number }` | ICE candidate |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `voice_room_state` | `{ channelId: string, participants: VoiceParticipant[] }` | Existing participants on join |
| `user_joined_voice` | `{ channelId: string, user: User }` | Someone joined channel |
| `user_left_voice` | `{ channelId: string, userId: string }` | Someone left channel |
| `voice_state_update` | `{ channelId: string, userId: string, selfMuted: boolean, selfDeafened: boolean }` | User toggled mute/deafen |
| `user_muted` | `{ channelId: string, userId: string, muted: boolean }` | Admin muted/unmuted user |
| `speaking` | `{ channelId: string, userId: string, speaking: boolean }` | User speaking state |
| `webrtc_offer` | `{ sdp: string }` | WebRTC offer from SFU |
| `webrtc_answer` | `{ sdp: string }` | WebRTC answer from SFU |
| `webrtc_ice` | `{ candidate: string, sdpMid: string, sdpMLineIndex: number }` | ICE candidate |

### 2.2 REST Endpoints (Moderation Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/voice/mute/:userId` | Server mute user (mod action) |
| `DELETE` | `/api/voice/mute/:userId` | Unmute user |

### 2.3 Design Decisions

**WebSocket-only for voice state:**
- Eliminates race conditions between REST success and WebSocket drop
- WebSocket connection state is the single source of truth
- TCP/WebSocket disconnect automatically triggers leave logic

**Unified state update:**
- `voice_state_update` covers both mute and deafen in one event
- Reduces event traffic compared to separate mute/deafen events

---

## 3. Frontend State Architecture

### 3.1 Zustand Store (useVoiceStore)

Serializable state — can be persisted to localStorage.

```typescript
interface VoiceState {
  // Current channel
  channelId: string | null

  // Remote participants
  participants: Map<string, VoiceParticipantState>

  // Your local screen share state (global)
  isScreenSharing: boolean

  // Your own state (synced to others)
  selfMuted: boolean
  selfDeafened: boolean
}

interface VoiceParticipantState {
  // Server-synced (broadcasted via WebSocket)
  muted: boolean           // Self-muted OR admin-muted
  deafened: boolean        // Self-deafened
  isScreenSharing: boolean // User is sharing their screen

  // Client-side local (never sent to server)
  localMuted: boolean     // YOU muted this user locally
  volume: number          // Your local volume (0.0 - 2.0)
}
```

**Screen sharing at two levels:**

| Level | Location | Tracks | Used for |
|-------|----------|--------|----------|
| Global | `useVoiceStore.isScreenSharing` | YOUR screen share | Toggle "Share screen" button, attach track to SFU |
| Per-user | `participants[userId].isScreenSharing` | OTHER users' screens | Show "Live" badge in channel list |

### 3.2 useVoiceRef (useRef)

Non-serializable, live objects — NOT in Zustand.

```typescript
interface VoiceRefs {
  localStream: MediaStream | null    // Mic stream
  screenStream: MediaStream | null   // Screen share stream
  sfuConnection: RTCPeerConnection  // Single SFU connection
  audioContext: AudioContext | null  // Single instance
}
```

### 3.3 Hooks

**useSFU()** — SFU WebRTC handling
```typescript
interface UseSFU {
  connect(channelId: string): Promise<void>
  disconnect(): void
  handleOffer(sdp: string): void
  handleAnswer(sdp: string): void
  handleIce(candidate: RTCIceCandidate): void
  sendOffer(): void
  sendAnswer(sdp: string): void
  sendIce(candidate: RTCIceCandidate): void
}
```

**useSpeakingDetection(stream)** — Audio analysis
- Interval: 100ms
- Method: AnalyserNode frequency data
- Threshold: avg > 20 = speaking

### 3.4 Cleanup on Leave

```typescript
function leaveChannel() {
  // 1. Stop all tracks
  localStream?.getTracks().forEach(t => t.stop())
  screenStream?.getTracks().forEach(t => t.stop())

  // 2. Close SFU connection
  sfuConnection?.close()

  // 3. Close audio context
  audioContext?.close()

  // 4. Clear refs
  localStream = null
  screenStream = null
  sfuConnection = null
  audioContext = null

  // 5. Wipe Zustand state
  set({
    channelId: null,
    participants: new Map(),
    isScreenSharing: false,
    selfMuted: false,
    selfDeafened: false
  })
}
```

---

## 4. Data Model

### 4.1 VoiceParticipant (Ephemeral, In-Memory)

Stored in Go server's RAM via `sync.Map` — not persisted to SQLite.

```go
type VoiceParticipant struct {
    UserID          string    `json:"user_id"`
    SelfMuted       bool      `json:"self_muted"`        // User toggled via WebSocket
    ServerMuted     bool      `json:"server_muted"`       // Admin muted via REST
    Deafened        bool      `json:"deafened"`
    IsScreenSharing bool      `json:"is_screen_sharing"`
    JoinedAt        time.Time `json:"joined_at"`
}
```

**Audio broadcast logic:**
```go
// User can speak if both are false
canSpeak := !participant.SelfMuted && !participant.ServerMuted
```

**State matrix:**

| SelfMuted | ServerMuted | UI Status | Audio |
|-----------|-------------|-----------|-------|
| false | false | 🎙️ Active | ✅ Transmit |
| true | false | 🔇 Muted (grey) | ❌ Blocked |
| false | true | 🔇 Server Muted (red) | ❌ Blocked |
| true | true | 🔇 Server Muted (red) | ❌ Blocked |

**UI icons:**
- Grey mic icon → SelfMuted = true
- Red mic icon → ServerMuted = true (regardless of SelfMuted)

### 4.2 VoiceSession (Ephemeral, In-Memory)

```go
type VoiceSession struct {
    ChannelID    string
    Participants map[string]*VoiceParticipant // key: userId
    mu           sync.RWMutex
}

type VoiceSessionManager struct {
    sessions map[string]*VoiceSession // key: channelId
    mu       sync.RWMutex
}
```

### 4.3 Operations

| Operation | Trigger | Actions |
|-----------|---------|---------|
| `Join(channelId, userId)` | `voice_join` WS event | Add to session, broadcast `user_joined_voice`, send `voice_room_state` |
| `Leave(channelId, userId)` | `voice_leave` WS event OR disconnect | Remove from session, stop SFU forwarding, broadcast `user_left_voice` |
| `UpdateState(channelId, userId, ...)` | `voice_state_update` WS event | Update fields, broadcast `voice_state_update` |
| `MuteUser(channelId, userId)` | `POST /api/voice/mute/:userId` | Set ServerMuted=true, broadcast `user_muted` |
| `UnmuteUser(channelId, userId)` | `DELETE /api/voice/mute/:userId` | Set ServerMuted=false, broadcast `user_muted` |

---

## 5. Signaling Protocol

### 5.1 Join Flow

```
Client                          Go Server                         SFU
  │                                  │                              │
  │ voice_join { channelId }         │                              │
  │─────────────────────────────────>│                              │
  │                                  │ Add to VoiceSession          │
  │                                  │─────────────────────────────>│
  │                                  │                              │
  │ voice_room_state { participants } │                              │
  │<─────────────────────────────────│                              │
  │                                  │                              │
  │                                  │              webrtc_offer    │
  │                                  │<─────────────────────────────│
  │ webrtc_offer { sdp }            │                              │
  │<─────────────────────────────────│                              │
  │                                  │                              │
  │ webrtc_answer { sdp }            │                              │
  │─────────────────────────────────>│ webrtc_answer { sdp }       │
  │                                  │─────────────────────────────>│
  │                                  │                              │
  │ webrtc_ice { candidate }         │                              │
  │─────────────────────────────────>│ webrtc_ice { candidate }    │
  │                                  │─────────────────────────────>│
  │                                  │                              │
  │                    ... ICE exchange ...                          │
  │                                  │                              │
  │ tracks ready <─────────────────────────────────────────────────│
```

**Key:** `voice_room_state` is sent BEFORE WebRTC negotiation starts. Client receives existing participants first, then establishes SFU connection.

### 5.2 State Sync Flow

```
Client                          Go Server
  │                                  │
  │ voice_state_update {             │
  │   selfMuted: true               │
  │ }                               │
  │─────────────────────────────────>│
  │                                  │ Update VoiceSession.SelfMuted
  │                                  │
  │ voice_state_update {             │
  │   userId, selfMuted: true        │
  │ }                               │
  │<─────────────────────────────────│
```

### 5.3 Leave Flow (Explicit)

```
Client                          Go Server
  │                                  │
  │ voice_leave { channelId }        │
  │─────────────────────────────────>│
  │                                  │ Remove from VoiceSession
  │                                  │ Stop SFU forwarding
  │                                  │
  │ user_left_voice { userId }       │
  │<─────────────────────────────────│
```

### 5.4 Disconnect Cleanup (Unexpected)

WebSocket disconnect automatically triggers leave logic:
1. Server detects WebSocket close event
2. Server runs leave logic
3. Server broadcasts `user_left_voice` to channel

### 5.5 Reconnect Flow

On WebSocket drop, client performs fresh reconnect:

```
1. WebSocket drops
        │
        ▼
2. Client: leaveChannel()
   ├── Wipe Zustand state
   ├── Close RTCPeerConnection
   └── Kill AudioContext
        │
        ▼
3. Client: Rebuild WebSocket connection
        │
        ▼
4. Client: Send voice_join { channelId }
        │
        ▼
5. (Fresh join flow, same as 5.1)
```

---

## 6. TBD

None — all decisions finalized.

# PeaceParrot — Private Voice & Chat App

**Version:** 1.0.0 **Date:** 2025-08-25 **Status:** Draft

---

## 1. Overview

### Summary

PeaceParrot is a lightweight Discord clone designed for small private
groups (up to 20 users online, 10 in voice). The app provides
real-time text chat, voice/video communication, screen sharing, and
essential moderation tools — all running on minimal hardware with zero
infrastructure cost.

### Goals

- **Minimal resource footprint** — runs on a personal PC alongside
  games, uses < 50MB RAM
- **Zero infrastructure cost** — self-hosted, no cloud bills
- **Discord-like experience** — familiar UX for friends, familiar
  features
- **Simple deployment** — single Go binary (SFU built-in)

### Non-Goals

- Large-scale deployment (20 users max)
- Public server discovery
- Complex integrations (bots, webhooks, third-party auth)
- Markdown-heavy formatting

---

## 2. Technical Architecture

### Database

- **SQLite (WAL mode)** — chat history, users, channels, roles
- **golang-migrate** — versioned migrations, run on startup
  - All schema changes via migration files, never manual SQL
  - Migration files in `migrations/` directory:
    ```
    migrations/
    ├── 000001_create_users.up.sql
    ├── 000001_create_users.down.sql
    ├── 000002_create_channels.up.sql
    ├── 000002_create_channels.down.sql
    └── ...
    ```
  - Never modify schema manually after initial migration

### Stack

| Component            | Technology             | Notes                                          |
| -------------------- | ---------------------- | ---------------------------------------------- |
| **Backend**          | Go + Echo/Fiber        | REST API + WebSocket server                    |
| **Database**         | SQLite (WAL mode)      | Chat history, users, channels, roles           |
| **WebRTC**           | pion/webrtc + pion/sfu | SFU-based voice, video (future), screen share  |
| **STUN/TURN**        | coturn (optional)      | NAT traversal for signaling only               |
| **Signaling**        | Go WebSocket           | WebRTC signaling + SFU media relay             |
| **SFU**              | pion/sfu               | Media routing (built into Go server)           |
| **Frontend**         | Tauri or Electron      | Desktop app shell                              |
| **Audio Processing** | WebRTC built-in DSP    | Noise suppression, echo cancellation, AGC, VAD |

### Deployment Model

**Option A — Personal PC (Recommended for start)**

- Go binary runs locally on host's PC (includes SFU)
- Friends connect via public IP or dynamic DNS (e.g., duckdns.org)
- Free — no server costs
- coturn (optional) for users behind strict NATs

**Option B — Cheap VPS ($3-5/mo)**

- coturn deployed on VPS for NAT traversal
- Go SFU binary connects to coturn over LAN
- More reliable for users on strict NATs

### Network Architecture

```
[User A] ────── WebRTC ──────> [Go Server]
    |                              |
    |         WebSocket            | (SFU relays media)
    |              +---- STUN/TURN (optional)
    |              |
    +---- WebRTC -+-> [User B]
    |                      |
    |                      |
    +---- WebRTC --------->+-> [User C]
```

- **Signaling:** All media connections negotiated through Go WebSocket
  server
- **Voice/Video:** SFU relay — media flows through Go server via
  pion/sfu
- **Chat:** Real-time via WebSocket; persisted to SQLite
- **Bandwidth (host):** ~1 Mbps (send 1 stream, receive N streams) +
  signaling overhead

---

## 3. Data Model

**Detailed documentation:** See `SPEC/spec-data-model.md`

---

## 4. Features

### 4.1 Authentication & Onboarding

#### Invite System

- **App-wide** — one invite grants access to the entire server
- **Single-use** — code burns after first account creation
- **Expiring** — admin sets 24h, 7 days, or never
- **Flow:** Admin generates invite → shares via private channel
  (WhatsApp/Signal) → new user creates account → code invalidated

#### User Registration

- Enter invite code
- Pick username (unique, 3-32 chars)
- Set password (bcrypt hashed)
- Optional: set display name, avatar, bio

#### User Roles

- **Admin** — 1 user (server owner), full control
- **Moderator** — N users, channel management + user moderation
- **User** — regular member, chat + voice only

### 4.2 Server & Channels

#### Server

- Single server only (private group)
- Admin sets name + icon
- Server lock: disable invite generation after all friends join

#### Channels

- Two types: **Text** (persistent history) and **Voice** (ephemeral
  sessions)
- Admin/Moderator creates, edits, deletes channels
- Optional channel topic/description
- Channels sorted by position in sidebar

### 4.3 Text Messaging

| Feature                | Details                                                  |
| ---------------------- | -------------------------------------------------------- |
| **Real-time delivery** | WebSocket push to all connected users in channel         |
| **History**            | SQLite persistence, paginated load (50 msgs per request) |
| **Timestamps**         | Display: "Today at 3:42 PM" or "Aug 25 at 3:42 PM"       |
| **Message limit**      | 4000 characters                                          |
| **Link previews**      | Fetch and display OpenGraph metadata for URLs            |
| **Reactions**          | Unicode emoji reactions, multiple per message            |
| **Edit**               | Inline edit, shows "edited" badge                        |
| **Delete**             | Soft delete, shows "[Message deleted]" placeholder       |
| **Search**             | Full-text search across all channels user has access to  |
| **Pinning**            | Pin important messages to channel top (max 50)           |
| **Typing indicators**  | "Afwan is typing..." appears for 3s after keystroke      |

### 4.4 Voice & Video

**Detailed architecture and implementation:** See `SPEC/spec-voice.md`

#### Voice Channels

- **Join/Leave** — instant, no waiting room
- **Session ephemeral** — no history, state lost when last user leaves
- **Voice activation** — default, configurable per user
- **Push-to-talk (PTT)** — optional, configurable per user
- **Speaking indicator** — visual ring/icon when user is talking

#### Controls

| Action                  | Details                                            |
| ----------------------- | -------------------------------------------------- |
| **Mute**                | Toggle mic off — others can't hear you             |
| **Deafen**              | Toggle speakers off — you can't hear anyone        |
| **Mute others (local)** | Per-user local mute — only affects your audio feed |
| **Per-user volume**     | Adjust volume slider per participant (0-200%)      |
| **Disconnect**          | Leave voice channel                                |

#### Screen Share

- Share entire screen or specific window
- Replaces video feed while active
- Click to share sound (system audio) optional
- Viewers see screen feed in voice channel UI

#### Video (Future)

- Camera support planned for post-v1.0
- Toggle camera on/off in voice channel

#### Audio Processing (Built-in)

- **Noise suppression** — WebRTC DSP, removes keyboard/fan noise
- **Echo cancellation** — OS-level or WebRTC
- **Automatic gain control** — normalizes mic levels
- **Voice activity detection** — detects when you're speaking

### 4.5 User Presence

#### Status Types

| Status               | Icon           | Notifications |
| -------------------- | -------------- | ------------- |
| Online               | 🟢 Green dot   | Enabled       |
| Away                 | 🌙 Yellow/moon | Enabled       |
| DND (Do Not Disturb) | ⛔ Red circle  | Disabled      |
| Invisible            | ⚪ Grey dot    | Disabled      |

- Status defaults to **Online** on login
- Users can manually switch status
- Status persists until manually changed

#### Online Presence

- Real-time updates via WebSocket
- Sidebar shows online users count per channel
- Member list shows all users with status icons

### 4.6 Moderation & Control

| Feature           | Details                                                         |
| ----------------- | --------------------------------------------------------------- |
| **Kick**          | Remove user from server — user can rejoin with existing account |
| **Ban**           | Permanent removal — user account disabled                       |
| **Mute (server)** | Prevent user from sending messages (text mute)                  |
| **Slow mode**     | Rate limit messages per channel (5s, 30s, 1m, 5m, etc.)         |
| **Server lock**   | Disable new invite generation                                   |

### 4.7 User Experience

#### UI Elements

| Feature               | Details                                              |
| --------------------- | ---------------------------------------------------- |
| **Unread indicators** | Badge on channels with new messages since last visit |
| **User list sorting** | Admins → Moderators → Users, then alphabetical       |
| **Server ping**       | Display connected server name + latency (ms) in UI   |
| **Theme toggle**      | Dark mode (default) + Light mode                     |

#### Desktop Notifications

- System notifications via OS (Windows/macOS)
- Triggered on new messages when:
  - User has **Online**, **Away**, or **Invisible** status →
    notifications on
  - User has **DND** status → notifications off
- Click notification → focus app, scroll to message

### 4.8 User Profiles

- **Display name** — shown in chat, overrides username
- **Avatar** — image upload (max 256KB, 128x128 display)
- **Bio** — short text (max 190 chars)
- View profile by clicking username in member list

---

## 5. API Design

**Detailed documentation:** See `SPEC/spec-api.md`

---

## 6. Code Standards

### Clean Code Principles

All code follows these principles to ensure maintainability and
readability:

#### General

- **Single Responsibility Principle** — each function/module does one thing well
- **KISS (Keep It Simple, Stupid)** — prefer simple solutions over clever ones
- **YAGNI (You Aren't Gonna Need It)** — don't build features until they're required
- **DRY (Don't Repeat Yourself)** — extract common logic into reusable functions
- **No magic numbers** — use named constants (e.g., `MaxMessageLength = 4000`)
- **Error wrapping** — always wrap with context (`fmt.Errorf("GetUser: %w", err)`)
- **Test coverage** — all functions require tests for happy path AND error cases
- **No commented-out code** — delete it, use git history
- **Comments explain "why", not "what"** — code tells what, comments tell why

#### Go-Specific

- **Package structure** — clear separation by domain (auth, channel,
  message, voice, etc.)
- **Interface-based design** — depend on interfaces, not concrete
  implementations
- **Error handling** — explicit error returns, never ignore errors
  silently
- **Context propagation** — pass `context.Context` for timeouts and
  cancellation
- **Dependency injection** — external dependencies injected, not
  global

#### Naming Conventions

| Thing           | Convention               | Example                            |
| --------------- | ------------------------ | ---------------------------------- |
| Variables       | camelCase                | `userID`, `messageCount`           |
| Functions       | PascalCase               | `GetUserByID`, `SendMessage`       |
| Constants       | PascalCase               | `MaxMessageLength`                 |
| Packages        | lowercase                | `auth`, `channel`, `voice`         |
| Interfaces      | PascalCase + "er" suffix | `Repository`, `Service`, `Handler` |
| Database tables | snake_case               | `user_status`, `voice_session`     |
| JSON fields     | snake_case               | `created_at`, `user_id`            |

#### Project Structure

```
peace-parrot/
├── cmd/
│   └── server/           — Main entry point
├── internal/
│   ├── auth/              — Authentication logic
│   ├── channel/           — Channel management
│   ├── message/           — Message handling
│   ├── voice/             — WebRTC voice logic
│   ├── user/              — User management
│   ├── moderation/        — Moderation tools
│   ├── invite/            — Invite system
│   └── websocket/         — WebSocket handler + sequencing
├── pkg/
│   ├── database/          — SQLite connection
│   ├── migrate/           — golang-migrate setup + migrations
│   ├── webrtc/            — pion/webrtc wrapper
│   └── utils/             — Shared utilities
├── migrations/            — SQL migration files (versioned)
├── config/                — Configuration
└── tests/                 — Integration tests
```

#### Code Review Checklist

- [ ] Function names clearly describe what they do
- [ ] No magic numbers — use named constants
- [ ] No God objects — keep structs small and focused
- [ ] Errors wrapped with context (`fmt.Errorf("GetUser: %w", err)`)
- [ ] Tests cover happy path + error cases
- [ ] No commented-out code — delete it, use git history
- [ ] No deep nesting — early returns preferred

---

## 7. Security Considerations

### Authentication

- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens with 7-day expiry
- Invite codes: 8-char alphanumeric, single-use, expiring

### Authorization

- Role checked on every API request
- Moderators can only act on users with lower roles
- Admins have full control

### Data

- SQLite WAL mode for concurrent reads
- No sensitive data in logs
- File uploads (avatars) size-limited and type-checked

### Network

- WebSocket over TLS in production
- WebRTC DTLS for media encryption
- TURN relay uses credentials

---

## 8. Performance Targets

| Metric                         | Target      |
| ------------------------------ | ----------- |
| **Concurrent users**           | 20          |
| **Voice users**                | 10          |
| **RAM usage (server)**         | < 50 MB     |
| **CPU usage (idle)**           | < 1%        |
| **CPU usage (10 voice users)** | < 10%       |
| **Network (host upload)**      | < 5 Mbps    |
| **Message latency**            | < 100ms     |
| **Voice latency**              | < 100ms     |
| **Startup time**               | < 3 seconds |

---

## 9. Out of Scope (v1.0)

- Markdown formatting
- Video camera support
- Server categories
- Custom server emoji
- Direct messages (DMs)
- Server-to-server federation
- Public server discovery
- Bots and webhooks
- Message threads
- Forum channels
- Stage channels
- Screen share audio (optional, OS-dependent)

---

## 10. Future Considerations

- **Video camera** — webcam support in voice channels
- **Direct messages** — private user-to-user chat
- **Server emoji** — custom uploaded emoji
- **Mobile app** — React Native or Flutter companion
- **Recording** — save voice conversations (consent required)
- **AI moderation** — auto-flag spam/profanity

---

## 11. Success Criteria

The app is successful when:

1. 20 users can connect simultaneously without degradation
2. Voice calls work reliably for users on common NAT types
3. Chat history loads instantly with no perceived lag
4. Server runs on a mid-range laptop without affecting gaming
   performance
5. Friends can set up their own invite and get going in under 5
   minutes
6. All moderation tools work as expected for admin/moderators

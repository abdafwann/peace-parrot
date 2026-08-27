# PeaceParrot — Task Breakdown

**Version:** 1.0.0
**Date:** 2025-08-26

---

## Milestone: Database

- [x] #1 Setup golang-migrate ✅
- [x] #2 Migration: 000001_create_users ✅
- [x] #3 Migration: 000002_create_channels ✅
- [x] #4 Migration: 000003_create_messages ✅
- [x] #5 Migration: 000004_create_reactions ✅
- [x] #6 Migration: 000005_create_pinned_messages ✅
- [x] #7 Migration: 000006_create_invites ✅
- [x] #8 Migration: 000007_create_server_settings ✅
- [x] #9 Migration: 000008_create_channel_read_state ✅
- [x] #10 Migration: 000009_create_link_previews ✅

---

## Milestone: Backend Core

- [x] Project structure (cmd/internal/pkg) ✅
- [x] Config loading (.env) ✅
- [x] Database connection (SQLite WAL) ✅
- [x] Health check endpoint (/health) ✅
- [x] Error response middleware ✅
- [x] Panic recovery middleware ✅

---

## Milestone: Auth

- [ ] POST /api/auth/register
- [ ] POST /api/auth/login
- [ ] JWT middleware
- [ ] In-memory rate limiter
- [ ] Cloudinary integration
- [ ] Avatar upload flow
- [ ] Role-based middleware
- [ ] Resource ownership middleware

---

## Milestone: Chat

- [ ] GET/POST /api/channels
- [ ] PATCH/DELETE /api/channels/:id
- [ ] GET /api/channels/:id/messages
- [ ] POST /api/channels/:id/messages
- [ ] PATCH /api/messages/:id
- [ ] DELETE /api/messages/:id
- [ ] GET /api/messages/search
- [ ] POST /api/messages/:id/reactions
- [ ] DELETE /api/messages/:id/reactions/:emoji
- [ ] GET/POST/DELETE /api/channels/:id/pins
- [ ] WebSocket: subscribe/unsubscribe
- [ ] WebSocket: typing indicators
- [ ] WebSocket: message events
- [ ] Link preview fetching

---

## Milestone: Voice

- [ ] VoiceSession manager (in-memory)
- [ ] WebSocket: voice_join/leave
- [ ] WebSocket: voice_state_update
- [ ] WebSocket: speaking indicator
- [ ] SFU integration (pion/sfu)
- [ ] WebRTC signaling
- [ ] Reconnection flow

---

## Milestone: Moderation

- [ ] POST /api/moderation/kick/:userId
- [ ] POST /api/moderation/ban/:userId
- [ ] POST/DELETE /api/moderation/mute/:userId
- [ ] POST/DELETE /api/voice/mute/:userId

---

## Milestone: Frontend Core

- [ ] Tauri setup
- [ ] Tailwind + shadcn/ui config
- [ ] Dark theme palette
- [ ] Layout shell
- [ ] Zustand stores
- [ ] WebSocket manager
- [ ] Theme toggle

---

## Milestone: Frontend Auth

- [ ] Login page
- [ ] Register page
- [ ] Auth state management
- [ ] Avatar upload UI

---

## Milestone: Frontend Chat

- [ ] Channel list UI
- [ ] Message list UI
- [ ] Message composer
- [ ] Typing indicators UI
- [ ] Reactions UI
- [ ] Link preview rendering

---

## Milestone: Frontend Voice

- [ ] Voice panel UI
- [ ] Voice state icons
- [ ] Speaking indicator
- [ ] Screen share UI
- [ ] Voice controls

---

## Milestone: Testing

- [ ] Auth handler tests
- [ ] Message handler tests
- [ ] Voice handler tests
- [ ] Race detection (go test -race)
- [ ] Memory profiling
- [ ] Integration tests

---

## Milestone: Deployment

- [ ] Docker Compose for coturn
- [ ] Cloudflare Tunnel config
- [ ] Let's Encrypt setup
- [ ] systemd service
- [ ] Database backup script

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | In Progress |
| 🔒 | Ready to start |

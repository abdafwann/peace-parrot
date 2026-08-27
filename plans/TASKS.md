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

- [x] POST /api/auth/register ✅
- [x] POST /api/auth/login ✅
- [x] JWT middleware ✅
- [x] In-memory rate limiter ✅
- [ ] Cloudinary integration (deferred)
- [ ] Avatar upload flow (deferred)
- [ ] Role-based middleware (deferred - no role in User table)
- [ ] Resource ownership middleware (deferred)

---

## Milestone: Chat

- [x] GET/POST /api/channels ✅
- [x] PATCH/DELETE /api/channels/:id ✅
- [x] GET /api/channels/:id/messages ✅
- [x] POST /api/channels/:id/messages ✅
- [x] PATCH /api/messages/:id ✅
- [x] DELETE /api/messages/:id ✅
- [x] GET /api/messages/search ✅
- [x] POST /api/messages/:id/reactions ✅
- [x] DELETE /api/messages/:id/reactions/:emoji ✅
- [x] GET/POST/DELETE /api/channels/:id/pins ✅
- [ ] WebSocket: subscribe/unsubscribe
- [ ] WebSocket: typing indicators
- [ ] WebSocket: message events
- [ ] Link preview fetching

---

## Milestone: Voice

- [x] VoiceSession manager (in-memory) ✅
- [x] Voice event handlers (join/leave/state_update) ✅
- [x] Voice moderation REST endpoints ✅
- [x] Voice unit tests ✅
- [ ] WebSocket integration
- [ ] SFU integration (pion/sfu)
- [ ] WebRTC signaling
- [ ] Reconnection flow

---

## Milestone: Moderation

- [x] POST /api/moderation/kick/:userId ✅
- [x] POST /api/moderation/ban/:userId ✅
- [x] DELETE /api/moderation/ban/:userId ✅
- [x] POST /api/moderation/mute/:userId ✅
- [x] DELETE /api/moderation/mute/:userId ✅
- [x] GET /api/moderation/status/:userId ✅
- [x] Migration: mutes, bans, kicks tables ✅

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

## Milestone: Frontend Core

- [x] Tauri setup ✅
- [x] Tailwind + design system ✅
- [x] Dark theme palette ✅
- [x] Layout shell (server/channel/member sidebars) ✅
- [x] Zustand stores ✅
- [x] Theme toggle ✅
- [ ] WebSocket manager (disabled until backend ready)

---

## Milestone: Frontend Auth

- [x] Login page ✅
- [x] Register page ✅
- [x] Auth state management ✅
- [ ] Avatar upload UI (deferred)

---

## Milestone: Frontend Chat

- [x] Channel list UI ✅
- [x] Message list UI ✅
- [x] Message composer ✅
- [x] Typing indicators UI ✅
- [x] Reactions UI ✅
- [x] Link preview rendering ✅

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

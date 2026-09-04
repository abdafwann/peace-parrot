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
- [x] WebSocket: subscribe/unsubscribe ✅
- [x] WebSocket: typing indicators ✅
- [x] WebSocket: message events ✅
- [ ] Link preview fetching

---

## Milestone: Voice

- [x] VoiceSession manager (in-memory) ✅
- [x] Voice event handlers (join/leave/state_update) ✅
- [x] Voice moderation REST endpoints ✅
- [x] Voice unit tests ✅
- [x] WebSocket integration ✅
- [x] SFU integration (pion/webrtc SFU engine) ✅
- [x] WebRTC signaling (Offer/Answer/ICE negotiation) ✅
- [x] Reconnection flow & speaking detection ✅

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

- [x] Tauri setup ✅
- [x] Tailwind + design system ✅
- [x] Dark theme palette ✅
- [x] Layout shell (server/channel/member sidebars) ✅
- [x] Zustand stores ✅
- [x] Theme toggle ✅
- [x] User Settings system (Profile, Voice & PTT, Notifications, Appearance) ✅
- [x] WebSocket manager ✅

---

## Milestone: Frontend Auth & Referral System

- [x] Dark Glassmorphic Auth Page with Ambient Glow & Animated Tabs ✅
- [x] Login page with input icons, password toggle & responsive feedback ✅
- [x] Register page with Referral Invite Code mandatory enforcement ✅
- [x] URL Query parameter referral code prefill (`?invite=PEAK-XXXX`) ✅
- [x] Live Invite Code validation feedback indicator ✅
- [x] Backend `internal/invite` store, handler & `/api/invites` REST API ✅
- [x] First-user admin bootstrap exemption ✅
- [x] Integration test suite for referral invite codes ✅
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

- [x] Voice panel UI (BottomSidebar voice connection widget) ✅
- [x] Voice state icons (Radio pulse, ping, active status) ✅
- [x] Speaking indicator (Speaking ring & green dot) ✅
- [x] Screen share UI (Quick action buttons & screen share state) ✅
- [x] Voice controls (Mute, deafen, disconnect, direct click join) ✅
- [x] Voice Channel Soundboard (Synthesizer, Web Audio SFX, custom sound uploads) ✅
- [x] Real-time soundboard broadcasting over WebSocket ✅

---

## Milestone: Chat & Media Attachments

- [x] Migration: 000016_add_message_attachments ✅
- [x] POST /api/upload endpoint (Cloudinary + Local Disk fallback) ✅
- [x] Message attachments JSON schema & database integration ✅
- [x] Drag & Drop file upload target overlay ✅
- [x] Composer attachment picker & pending attachments strip (10 MB cap) ✅
- [x] Message list image rendering & responsive media grid ✅
- [x] Fullscreen dark glassmorphic Image Lightbox Modal with zoom & download ✅
- [x] Non-image document & audio/video attachments rendering ✅

---

## Milestone: Testing

- [x] Auth handler & JWT tests ✅
- [x] Message & Channel handler tests ✅
- [x] Voice & SFU engine handler tests ✅
- [x] Moderation & Role permissions tests ✅
- [x] API Integration & multipart upload tests ✅
- [x] Frontend TypeScript & Vite bundle validation ✅
- [ ] Memory profiling & load testing (deferred)

---

## Milestone: Deployment

- [x] Dockerfile & Docker Compose for Backend + coturn STUN/TURN ✅
- [x] Cloudflare Tunnel configuration & Compose service ✅
- [x] Reverse Proxy & SSL (Caddy Auto-SSL & Nginx templates) ✅
- [x] systemd service unit with security hardening ✅
- [x] SQLite WAL-Safe Online Backup & Restore scripts ✅
- [x] Deployment guide & documentation ✅

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | In Progress |
| 🔒 | Ready to start |

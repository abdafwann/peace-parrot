# PeaceParrot — Data Model Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec documents all data entities, organized by persistence strategy.

---

## 2. Persistent Entities (SQLite)

*Managed via golang-migrate migration files.*

```
User
├── id (UUID)
├── username (unique)
├── password_hash (bcrypt)
├── avatar_url
├── display_name
├── bio (optional)
├── created_at
└── updated_at

Role
├── id
├── name (admin, moderator, user)
└── permissions (JSON)

Channel
├── id (UUID)
├── name
├── type (text, voice)
├── topic / description (optional)
├── position (order in sidebar)
├── created_by (User FK)
├── created_at
└── updated_at

Message
├── id (UUID)
├── channel_id (FK)
├── author_id (FK)
├── content (text, max 4000 chars)
├── created_at
├── edited_at (nullable)
└── deleted_at (nullable)

Reaction
├── id
├── message_id (FK)
├── user_id (FK)
├── emoji (unicode)
└── created_at

PinnedMessage
├── id
├── message_id (FK)
├── pinned_by (User FK)
└── pinned_at

Invite
├── id (UUID)
├── code (8-char alphanumeric)
├── created_by (User FK)
├── expires_at (nullable)
├── used (boolean)
├── used_by (User FK, nullable)
└── created_at

ServerSettings
├── id
├── name
├── icon_url
├── owner_id (User FK)
├── invite_expiry_default (hours: 24, 168, null = never)
└── slow_mode_seconds (0 = off)

ChannelReadState
├── user_id (FK)
├── channel_id (FK)
└── last_message_id (FK)

LinkPreview
├── id
├── message_id (FK)
├── url
├── title
├── description
├── image_url
├── site_name
└── created_at
```

---

## 3. Ephemeral Entities (Go In-Memory / sync.Map)

*Kept in server's RAM — NOT persisted to SQLite.*

```
UserStatus
├── user_id (FK)
├── status (online, away, dnd, invisible)
└── updated_at

VoiceSession
├── channel_id (key)
├── user_id (key)
├── self_muted (boolean)
├── server_muted (boolean)
├── deafened (boolean)
├── is_screen_sharing (boolean)
└── joined_at
```

---

## 4. Permissions Matrix

| Action                  | Admin | Moderator | User |
| ----------------------- | ----- | --------- | ---- |
| Create channel          | ✅    | ✅        | ❌   |
| Delete channel          | ✅    | ❌        | ❌   |
| Edit channel            | ✅    | ✅        | ❌   |
| Manage users (kick/ban) | ✅    | ✅        | ❌   |
| Mute users (voice)      | ✅    | ✅        | ❌   |
| Manage invites          | ✅    | ✅        | ❌   |
| Pin messages            | ✅    | ✅        | ❌   |
| Send messages           | ✅    | ✅        | ✅   |
| Join voice              | ✅    | ✅        | ✅   |
| Speak in voice          | ✅    | ✅        | ✅   |
| React to messages       | ✅    | ✅        | ✅   |

---

## 5. TBD

None — all decisions finalized.

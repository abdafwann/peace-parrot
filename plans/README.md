# PeaceParrot — Project Specifications

**Version:** 1.0.0
**Date:** 2025-08-26
**Status:** Draft

---

## Overview

PeaceParrot is a lightweight Discord clone for small private groups (up to 20 users online, 10 in voice). This directory contains all project specifications.

---

## Documentation Structure

```
plans/
├── README.md                    # This file
├── peace-parrot-prd.md        # Product Requirements Document
└── SPEC/
    ├── spec-auth.md          # Authentication & Authorization
    ├── spec-chat.md          # Chat & Messaging
    ├── spec-voice.md        # Voice System (SFU)
    ├── spec-deployment.md    # Deployment & Infrastructure
    ├── spec-error-handling.md # Error Response Format
    ├── spec-migrations.md    # Database Migrations
    ├── spec-testing.md       # Testing Requirements
    ├── spec-client-ui.md     # Client UI Design
    ├── spec-tools.md        # Tools & Dependencies
    ├── spec-data-model.md   # Entity Definitions
    └── spec-api.md          # REST & WebSocket API
```

---

## Quick Reference

| Spec | Purpose |
|------|---------|
| `peace-parrot-prd.md` | High-level overview, goals, architecture summary |
| `spec-auth.md` | User registration, login, JWT, authorization |
| `spec-chat.md` | Messages, reactions, typing indicators, link previews |
| `spec-voice.md` | SFU voice, WebRTC signaling, screen share |
| `spec-deployment.md` | Server setup, Cloudflare Tunnel, TURN server |
| `spec-error-handling.md` | Error codes, logging policy, panic recovery |
| `spec-migrations.md` | SQL migration conventions, golang-migrate |
| `spec-testing.md` | Race detection, memory limits, DB isolation |
| `spec-client-ui.md` | Dark theme, Tailwind, shadcn/ui components |
| `spec-tools.md` | Go/Node dependencies, project structure |
| `spec-data-model.md` | Entity definitions, permissions matrix |
| `spec-api.md` | REST endpoints, WebSocket events |

---

## Tech Stack

| Component | Technology |
|-----------|-------------|
| Backend | Go + Echo |
| Database | SQLite (WAL mode) |
| WebRTC | pion/webrtc + pion/sfu (SFU) |
| Frontend | Tauri + React + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Migrations | golang-migrate |
| Real-time | WebSocket |

---

## Key Decisions

### Architecture
- **SFU-based voice** — media relayed through Go server via pion/sfu
- **Single source of truth** — WebSocket for voice state, REST for moderation
- **Ephemeral voice sessions** — stored in-memory, not persisted

### Security
- **JWT tokens** — 7-day expiry, no refresh
- **bcrypt** — password hashing, cost factor 12
- **Role hierarchy** — Admin > Moderator > User

### Performance
- **100MB memory cap** — strict performance guardrails
- **Race detection** — `go test -race` mandatory
- **In-memory DB** — SQLite for integration tests

---

## Getting Started

1. Read `peace-parrot-prd.md` for high-level overview
2. Review relevant specs for implementation details
3. See `spec-deployment.md` for server setup
4. See `spec-tools.md` for development environment

---

## Contributing

When adding features:
1. Update relevant spec(s)
2. Get approval on design
3. Create implementation plan
4. Follow code standards in PRD Section 6

---

## Status Legend

| Status | Meaning |
|--------|---------|
| Draft | In progress |
| Finalized | Approved, ready for implementation |


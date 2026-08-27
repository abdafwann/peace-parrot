# PeaceParrot — Tools & Dependencies Spec

**Parent:** peace-parrot-prd.md
**Status:** Finalized
**Date:** 2025-08-25

---

## 1. Overview

This spec documents all tools, libraries, and dependencies required to build PeaceParrot.

---

## 2. Backend (Go)

### 2.1 Core

| Tool | Purpose | Version |
|------|---------|---------|
| **Go** | Language | 1.21+ |
| **Echo** | HTTP framework | v4 |

### 2.2 WebSocket

| Tool | Purpose | Version |
|------|---------|---------|
| **gorilla/websocket** | WebSocket server | Latest |

### 2.3 Database

| Tool | Purpose | Version |
|------|---------|---------|
| **modernc.org/sqlite** | Pure Go SQLite driver | Latest |
| **golang-migrate/migrate** | Database migrations | v4 |

> **Note:** Pure Go driver chosen over CGO. Performance difference is < 0.5ms — negligible for this use case. Pure Go enables clean cross-compilation.

### 2.4 WebRTC

| Tool | Purpose | Version |
|------|---------|---------|
| **pion/webrtc** | WebRTC stack (Go backend) | v3 |

### 2.5 Utilities

| Tool | Purpose | Version |
|------|---------|---------|
| **google/uuid** | UUID generation | Latest |
| **golang-jwt/jwt** | JWT tokens | v5 |
| **bcrypt** | Password hashing | Built-in Go |
| **stretchr/testify** | Testing | Latest |

---

## 3. Frontend (Tauri + React)

### 3.1 Tauri

| Tool | Purpose | Version |
|------|---------|---------|
| **Tauri CLI** | Build tooling | v2 |
| **Rust toolchain** | Native backend | Latest |
| **WebView2** | Windows rendering | Pre-installed on Win10+ |

### 3.2 React

| Tool | Purpose | Version |
|------|---------|---------|
| **React** | UI framework | 18+ |
| **TypeScript** | Type safety | 5+ |
| **Vite** | Build tool | Latest |
| **TailwindCSS** | Styling | Latest |

### 3.3 UI Components

| Tool | Purpose | Version |
|------|---------|---------|
| **shadcn/ui** | Copy-paste components (built on Radix) | Latest |
| **Radix UI** | Headless accessible primitives (via shadcn) | Latest |
| **Lucide React** | Icons | Latest |
| **date-fns** | Date formatting | Latest |

### 3.4 State Management

| Tool | Purpose | Version |
|------|---------|---------|
| **Zustand** | Global state | Latest |

### 3.5 Real-time & WebRTC

| Tool | Purpose | Version |
|------|---------|---------|
| **Native WebRTC API** | Browser built-in | — |

> **Note:** Frontend uses browser's native WebRTC API (via WebView). pion/webrtc is Go backend only.

### 3.6 Chat-Specific

| Tool | Purpose | Version |
|------|---------|---------|
| **react-window** | Virtualized list for messages | Latest |
| **linkifyjs** | Link detection in text | Latest |
| **Custom fetch** | Link previews (OpenGraph) | — |

### 3.7 Build & Dev

| Tool | Purpose | Version |
|------|---------|---------|
| **ESLint** | Linting | Latest |
| **Prettier** | Formatting | Latest |
| **Husky** | Git hooks | Latest |
| **lint-staged** | Pre-commit lint | Latest |

---

## 4. DevOps & Infrastructure

### 4.1 Container

| Tool | Purpose | Version |
|------|---------|---------|
| **Docker** | coturn deployment | Latest |
| **Docker Compose** | Multi-container orchestration | Latest |

### 4.2 TURN Server

| Tool | Purpose | Notes |
|------|---------|-------|
| **coturn** | TURN relay | Self-hosted on VPS |
| **Metered.ca** | Free TURN fallback | Optional, for users behind strict NATs |

### 4.3 Networking

| Tool | Purpose | Notes |
|------|---------|-------|
| **Cloudflare Tunnel** | Expose local server | Free, no port forwarding |
| **duckdns** | Dynamic DNS | Free subdomain |
| **Let's Encrypt** | TLS certificates | Free, for production |

---

## 5. Project Structure

```
peace-parrot/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── auth/
│   ├── channel/
│   ├── message/
│   ├── voice/
│   ├── user/
│   ├── moderation/
│   ├── invite/
│   └── websocket/
├── pkg/
│   ├── database/
│   ├── migrate/
│   ├── webrtc/
│   └── utils/
├── migrations/
│   ├── 000001_create_users.up.sql
│   ├── 000001_create_users_down.sql
│   └── ...
├── web/                    # Tauri frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── App.tsx
│   ├── src-tauri/
│   └── package.json
├── config/
├── go.mod
├── go.sum
└── Makefile
```

---

## 6. Development Environment Setup

### Prerequisites

```bash
# Install Go
go install

# Install Node.js (for frontend)
# https://nodejs.org/

# Install pnpm (package manager)
npm install -g pnpm

# Install Rust (for Tauri)
# https://rustup.rs/

# Install Tauri CLI
pnpm add -g @tauri-apps/cli

# Install Docker (for coturn)
# https://docker.com/
```

### Quick Start

```bash
# Backend
cd peace-parrot
go mod download
go run ./cmd/server

# Frontend
cd web
pnpm install
pnpm tauri dev
```

---

## 7. TBD

None — all tool decisions finalized.

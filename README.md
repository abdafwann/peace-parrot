# PeaceParrot

A lightweight Discord clone for small private groups (up to 20 users online, 10 in voice).

## Tech Stack

- **Backend:** Go + Echo
- **Database:** SQLite (WAL mode)
- **WebRTC:** pion/webrtc + pion/sfu (SFU)
- **Frontend:** Tauri + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Migrations:** golang-migrate
- **Real-time:** WebSocket

## Getting Started

### Prerequisites

- Go 1.21+
- Node.js (for frontend)
- pnpm
- Rust (for Tauri)

### Backend Setup

```bash
# Install dependencies
go mod download

# Copy environment template
cp .env.example .env

# Run the server
go run ./cmd/server/
```

### Frontend Setup

```bash
cd web
pnpm install
pnpm tauri dev
```

## Project Structure

```
peace-parrot/
├── cmd/server/           # Entry point
├── internal/database/    # Database migrations
├── pkg/
│   ├── config/          # Configuration
│   ├── database/        # DB connection
│   └── middleware/      # HTTP middleware
├── migrations/          # SQL migrations
├── web/                 # Tauri frontend
└── plans/              # Project specs
```

## API

- `GET /health` - Health check
- `POST /api/auth/register` - Register (TBD)
- `POST /api/auth/login` - Login (TBD)

## License

MIT

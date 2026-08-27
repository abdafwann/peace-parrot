# PeaceParrot — Deployment Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec covers deployment and infrastructure for PeaceParrot.

---

## 2. Deployment Options

### Option A — Personal PC (Recommended for start)

- Go binary runs locally on host's PC (includes SFU)
- Friends connect via Cloudflare Tunnel or public IP
- Free — no server costs
- coturn (optional) for users behind strict NATs

### Option B — Cheap VPS ($3-5/mo)

- coturn deployed on VPS for NAT traversal
- Go binary connects to coturn over LAN
- More reliable for users on strict NATs

---

## 3. Prerequisites

### For All Deployments

- Go 1.21+
- SQLite (WAL mode, built-in)
- Port 443 open (for WebSocket/WSS)
- Domain name (optional, for Let's Encrypt)

### For Cloudflare Tunnel

- Cloudflare account (free)
- cloudflared installed on host

### For TURN Server

- Docker + Docker Compose

---

## 4. Configuration

### Environment Variables (.env)

Create a `.env` file in the same directory as the binary:

```env
# Server
HOST=0.0.0.0
PORT=443

# JWT
JWT_SECRET=your-secret-key-min-32-characters-long

# Database
DB_PATH=./peace-parrot.db

# Cloudinary (optional, for avatar uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# TURN Server (optional)
TURN_SERVER=turn:your-turn-server:3478
TURN_USERNAME=turn-user
TURN_PASSWORD=turn-password
```

---

## 5. Local Development

```bash
# Clone repo
git clone https://github.com/your-repo/peace-parrot
cd peace-parrot

# Install dependencies
go mod download

# Run server
go run ./cmd/server

# Server starts at http://localhost:8080
# WebSocket at ws://localhost:8080/ws
```

---

## 6. Cloudflare Tunnel Setup

### 6.1 Install cloudflared

**Linux/macOS:**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

**Windows:**
Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

### 6.2 Quick Setup Guide

1. **Authenticate cloudflared:**
   ```bash
   cloudflared tunnel login
   ```
   Opens browser for Cloudflare authentication.

2. **Create tunnel:**
   ```bash
   cloudflared tunnel create peace-parrot
   ```
   Note the tunnel UUID.

3. **Configure tunnel:**
   Create `config.yml` in same directory as cloudflared:
   ```yaml
   tunnel: <TUNNEL-UUID>
   credentials-file: /path/to/credentials-file.json

   ingress:
     - hostname: peace.example.com
       service: https://localhost:443
       originRequest:
         noTLSVerify: false

     - service: http_status:404
   ```

4. **Route domain:**
   ```bash
   cloudflared tunnel route dns peace-parrot peace.example.com
   ```

5. **Run tunnel:**
   ```bash
   cloudflared tunnel run peace-parrot
   ```

### 6.3 Cloudflare Tunnel Config Example

```yaml
# config.yml
tunnel: abc123-def456-ghi789
credentials-file: /home/user/.cloudflared/abc123-def456-ghi789.json

ingress:
  - hostname: peace.example.com
    service: https://localhost:443
    originRequest:
      noTLSVerify: false
      connectTimeout: 30s
      tlsTimeout: 10s

  - service: http_status:404
```

---

## 7. TLS/HTTPS

### Production (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d peace.example.com

# Server reads certificates
CERT_DIR=/etc/letsencrypt/live/peace.example.com
```

Server environment:
```env
TLS_CERT_PATH=/etc/letsencrypt/live/peace.example.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/peace.example.com/privkey.pem
```

### Local Development (Self-Signed)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Server environment
TLS_CERT_PATH=./cert.pem
TLS_KEY_PATH=./key.pem
```

---

## 8. TURN Server (coturn)

### 8.1 Docker Compose

```yaml
# docker-compose.yml
version: '3'

services:
  coturn:
    image: coturn/coturn:latest
    container_name: peace-parrot-turn
    ports:
      - "3478:3478"
      - "3478:3478/udp"
      - "5349:5349"
      - "5349:5349/udp"
    environment:
      - TURNSERVER_ENABLED=1
      - SECRET=your-turn-secret
      -realm=peace-parrot
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf
    restart: unless-stopped
```

### 8.2 Manual Setup

```bash
# Install coturn
sudo apt install coturn

# Edit /etc/coturn/turnserver.conf
```

Minimal turnserver.conf:
```conf
listening-port=3478
lt-cred-mech
realm=peace-parrot
server-name=peace-parrot
secret=your-turn-secret
total-quota=100
bps-capacity=0
```

Enable and start:
```bash
sudo systemctl enable coturn
sudo systemctl start coturn
```

### 8.3 Connect Server to TURN

```env
TURN_SERVER=turn:your-turn-server:3478
TURN_USERNAME=turn-user
TURN_PASSWORD=turn-password
```

---

## 9. Database Backup

### 9.1 Simple Copy (When Server Stopped)

```bash
# Stop server, then copy
cp peace-parrot.db peace-parrot-backup-$(date +%Y%m%d).db
```

### 9.2 Safe WAL Checkpoint (While Server Running)

```bash
# SQLite WAL checkpoint ensures all writes are flushed to main db file
sqlite3 peace-parrot.db "PRAGMA wal_checkpoint(FULL);"

# Now safe to copy
cp peace-parrot.db peace-parrot-backup-$(date +%Y%m%d).db
```

### 9.3 Restore from Backup

```bash
# Stop server
# Replace db file
cp peace-parrot-backup-20250826.db peace-parrot.db
# Start server
```

---

## 10. Health Check Endpoint

### Endpoint

```
GET /health
```

### Response (200 OK)

```json
{
  "status": "ok",
  "database": "connected",
  "uptime": "2h30m"
}
```

### Response (503 Service Unavailable)

```json
{
  "status": "error",
  "database": "disconnected",
  "uptime": "0s"
}
```

---

## 11. Process Management

### Linux (systemd)

Create service file: `/etc/systemd/system/peace-parrot.service`

```ini
[Unit]
Description=PeaceParrot Server
After=network.target

[Service]
Type=simple
User=peace-parrot
WorkingDirectory=/opt/peace-parrot
ExecStart=/opt/peace-parrot/peace-parrot
Restart=always
RestartSec=5
EnvironmentFile=/opt/peace-parrot/.env

[Install]
WantedBy=multi-user.target
```

Commands:
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable peace-parrot

# Start/stop/restart
sudo systemctl start peace-parrot
sudo systemctl stop peace-parrot
sudo systemctl restart peace-parrot

# Check status
sudo systemctl status peace-parrot

# View logs
sudo journalctl -u peace-parrot -f
```

### Windows

**Option A: Batch Script Loop**

Create `run.bat`:
```batch
@echo off
:loop
    start "" peace-parrot.exe
    timeout /t 5
    goto loop
```

Run as Administrator for auto-restart on crash.

**Option B: Task Scheduler**

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: "On failure of task"
4. Action: Start a program → `peace-parrot.exe`
5. Set conditions: Restart on failure

---

## 12. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `HOST` | Yes | Server bind address (default: 0.0.0.0) |
| `PORT` | Yes | Server port (default: 443) |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `DB_PATH` | No | SQLite database path (default: ./peace-parrot.db) |
| `TLS_CERT_PATH` | No | TLS certificate path |
| `TLS_KEY_PATH` | No | TLS key path |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret |
| `TURN_SERVER` | No | TURN server URL |
| `TURN_USERNAME` | No | TURN username |
| `TURN_PASSWORD` | No | TURN password |

---

## 13. TBD

None — all decisions finalized.

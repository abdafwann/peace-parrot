# 🚀 Roompeak (PeaceParrot) — Deployment Guide

Dokumen panduan lengkap untuk deploy Roompeak Backend, WebRTC STUN/TURN (coturn), Cloudflare Tunnel, dan Reverse Proxy (Caddy/Nginx).

---

## 📑 Daftar Isi
1. [Struktur File Deployment](#struktur-file-deployment)
2. [Opsi 1: Quickstart dengan Docker Compose (Rekomendasi)](#opsi-1-quickstart-dengan-docker-compose-rekomendasi)
3. [Opsi 2: Baremetal / VPS dengan systemd & Nginx / Caddy](#opsi-2-baremetal--vps-dengan-systemd--nginx--caddy)
4. [Konfigurasi WebRTC STUN / TURN (coturn)](#konfigurasi-webrtc-stun--turn-coturn)
5. [Konfigurasi Cloudflare Tunnel](#konfigurasi-cloudflare-tunnel)
6. [Backup & Restore Database Otomatis](#backup--restore-database-otomatis)

---

## 📁 Struktur File Deployment

```text
Roompeak/
├── Dockerfile                          # Multi-stage production build (Go 1.24 + Alpine)
├── docker-compose.yml                  # Compose untuk Backend + coturn STUN/TURN
└── deploy/
    ├── README.md                       # Panduan deployment ini
    ├── caddy/
    │   └── Caddyfile                   # Reverse proxy dengan auto SSL Let's Encrypt
    ├── nginx/
    │   └── roompeak.conf               # Nginx reverse proxy + WebSocket headers
    ├── coturn/
    │   └── turnserver.conf             # Konfigurasi STUN/TURN relay server
    ├── cloudflare/
    │   ├── config.yml                  # Cloudflare named tunnel routing
    │   └── docker-compose.tunnel.yml   # Compose untuk daemon cloudflared
    ├── systemd/
    │   └── roompeak.service            # Unit systemd untuk Linux VPS
    └── scripts/
        ├── backup-db.sh                # Backup online SQLite WAL aman tanpa downtime
        └── restore-db.sh               # Restore snapshot database
```

---

## 🐳 Opsi 1: Quickstart dengan Docker Compose (Rekomendasi)

### 1. Buat file `.env`
Salin file `.env.example` menjadi `.env` di root direktori:
```bash
cp .env.example .env
```
Isi konfigurasi produksi:
```env
JWT_SECRET=gunakan-string-acak-panjang-dan-aman-64-karakter
JWT_EXPIRY_DAYS=7
SERVER_PORT=8080
```

### 2. Jalankan Container
```bash
docker compose up -d --build
```

Layanan yang aktif:
- **Backend API & WebSockets**: `http://localhost:8080`
- **Health Check**: `http://localhost:8080/health`
- **coturn STUN/TURN**: port `3478` (UDP/TCP) & `49152-65535` (UDP relay)

---

## 🐧 Opsi 2: Baremetal / VPS dengan systemd & Nginx / Caddy

### 1. Build Binary untuk Linux
```bash
CGO_ENABLED=1 GOOS=linux go build -o server ./cmd/server
```

### 2. Pasang ke VPS Linux
```bash
sudo useradd -r -s /bin/false roompeak
sudo mkdir -p /opt/roompeak /opt/roompeak/data /opt/roompeak/uploads
sudo cp server /opt/roompeak/
sudo cp -r migrations /opt/roompeak/
sudo cp .env.example /opt/roompeak/.env
sudo chown -R roompeak:roompeak /opt/roompeak
```

### 3. Aktifkan systemd Service
```bash
sudo cp deploy/systemd/roompeak.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now roompeak
sudo systemctl status roompeak
```

### 4. Reverse Proxy dengan Caddy (Auto SSL)
```bash
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 🎙️ Konfigurasi WebRTC STUN / TURN (coturn)

Agar voice channel dan WebRTC SFU dapat terhubung antar user di balik NAT / WiFi publik ketat:

1. Edit [`deploy/coturn/turnserver.conf`](file:///e:/Roompeak/deploy/coturn/turnserver.conf):
   ```conf
   realm=yourdomain.com
   user=roompeak_user:SecretPassword123!
   ```
2. Buka port firewall di VPS / Cloud provider:
   - `3478/udp` dan `3478/tcp` (STUN/TURN listening)
   - `49152-65535/udp` (Relay media port range)

---

## ☁️ Konfigurasi Cloudflare Tunnel

Jika tidak ingin membuka port publik langsung atau server berada di balik IP dinamis / CGNAT:

1. Buat Tunnel di dashboard Cloudflare Zero Trust:
   ```bash
   cloudflared tunnel create roompeak-tunnel
   ```
2. Sesuaikan file [`deploy/cloudflare/config.yml`](file:///e:/Roompeak/deploy/cloudflare/config.yml) dengan UUID Tunnel kamu.
3. Jalankan Cloudflare Tunnel:
   ```bash
   docker compose -f deploy/cloudflare/docker-compose.tunnel.yml up -d
   ```

---

## 💾 Backup & Restore Database Otomatis

Database menggunakan SQLite WAL mode. Skrip [`deploy/scripts/backup-db.sh`](file:///e:/Roompeak/deploy/scripts/backup-db.sh) menggunakan API online backup SQLite sehingga aman dijalankan saat server sedang beroperasi tanpa memicu *database locked*.

### Setup Cron Backup Harian (Misal jam 02:00 pagi):
```bash
crontab -e
```
Tambahkan baris berikut:
```cron
0 2 * * * /opt/roompeak/deploy/scripts/backup-db.sh >> /var/log/roompeak-backup.log 2>&1
```

### Restore Database dari Snapshot:
```bash
./deploy/scripts/restore-db.sh /app/backups/peace_parrot_backup_YYYYMMDD_HHMMSS.db.gz
```

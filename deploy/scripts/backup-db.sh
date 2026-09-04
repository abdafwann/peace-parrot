#!/bin/bash
# ==============================================================================
# SQLite WAL-Safe Online Backup Script for Roompeak (PeaceParrot)
# Uses SQLite's online backup API (.backup) to ensure zero corruption while active.
# ==============================================================================

set -euo pipefail

# Configuration
DB_PATH="${DB_PATH:-/app/data/peace-parrot.db}"
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/peace_parrot_backup_${TIMESTAMP}.db"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting SQLite backup for: ${DB_PATH}"

if [ ! -f "${DB_PATH}" ]; then
    echo "[$(date)] ERROR: Database file does not exist at ${DB_PATH}" >&2
    exit 1
fi

# Perform safe online backup using sqlite3 CLI
sqlite3 "${DB_PATH}" ".backup '${BACKUP_FILE}'"

# Compress backup with gzip
gzip -9 "${BACKUP_FILE}"
echo "[$(date)] Backup completed: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))"

# Prune backups older than retention days
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "peace_parrot_backup_*.db.gz" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date)] Backup rotation completed successfully."

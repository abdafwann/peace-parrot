#!/bin/bash
# ==============================================================================
# SQLite Database Restore Script for Roompeak (PeaceParrot)
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path-to-backup.db.gz>"
    echo "Example: $0 /app/backups/peace_parrot_backup_20260904_120000.db.gz"
    exit 1
fi

BACKUP_ARCHIVE="$1"
TARGET_DB="${DB_PATH:-/app/data/peace-parrot.db}"

if [ ! -f "${BACKUP_ARCHIVE}" ]; then
    echo "ERROR: Backup file ${BACKUP_ARCHIVE} not found!" >&2
    exit 1
fi

echo "WARNING: This will replace the existing database at ${TARGET_DB}!"
read -p "Are you sure you want to proceed? (y/N): " -r CONFIRM
if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
    echo "Restore canceled."
    exit 0
fi

# Remove existing WAL and SHM files to avoid index corruption
rm -f "${TARGET_DB}-wal" "${TARGET_DB}-shm"

# Extract archive directly into target DB
gunzip -c "${BACKUP_ARCHIVE}" > "${TARGET_DB}"

echo "Database restored successfully from ${BACKUP_ARCHIVE} to ${TARGET_DB}."

#!/usr/bin/env bash
# ==============================================================================
# AI Event Planner - Database Backup Script
# Creates a timestamped backup with SHA-256 integrity checksum.
# Supports Docker Compose PostgreSQL, native PostgreSQL, and SQLite.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "${BACKUP_DIR}"

POSTGRES_DB="${POSTGRES_DB:-event_planner_db}"
POSTGRES_USER="${POSTGRES_USER:-event_user}"
DATABASE_URL="${DATABASE_URL:-}"

echo "==> Starting database backup at ${TIMESTAMP}..."

# Case 1: Docker Compose PostgreSQL running
if command -v docker &>/dev/null && docker compose ps --services 2>/dev/null | grep -q "^db$"; then
    BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"
    echo "--> Detected Docker Compose PostgreSQL service. Dumping to ${BACKUP_FILE}..."
    docker compose exec -T db pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists > "${BACKUP_FILE}"

# Case 2: Native PostgreSQL via pg_dump
elif command -v pg_dump &>/dev/null && [[ "${DATABASE_URL}" =~ postgresql ]]; then
    BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"
    echo "--> Detected native pg_dump tool. Dumping from ${DATABASE_URL%%@*}@... to ${BACKUP_FILE}..."
    pg_dump "${DATABASE_URL}" --clean --if-exists > "${BACKUP_FILE}"

# Case 3: SQLite fallback
elif [ -f "${PROJECT_ROOT}/backend/event_planner.db" ]; then
    BACKUP_FILE="${BACKUP_DIR}/sqlite_backup_${TIMESTAMP}.db"
    echo "--> Detected SQLite database. Backing up ${PROJECT_ROOT}/backend/event_planner.db to ${BACKUP_FILE}..."
    if command -v sqlite3 &>/dev/null; then
        sqlite3 "${PROJECT_ROOT}/backend/event_planner.db" ".backup '${BACKUP_FILE}'"
    else
        cp "${PROJECT_ROOT}/backend/event_planner.db" "${BACKUP_FILE}"
    fi

else
    echo "Error: No reachable database detected for backup." >&2
    exit 1
fi

# Verification: Check file size > 0
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "Error: Backup file is empty or missing: ${BACKUP_FILE}" >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Generate SHA-256 Checksum
if command -v sha256sum &>/dev/null; then
    sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
elif command -v shasum &>/dev/null; then
    shasum -a 256 "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
fi

FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "==> Backup completed successfully!"
echo "    File:     ${BACKUP_FILE} (${FILE_SIZE})"
echo "    Checksum: ${BACKUP_FILE}.sha256"


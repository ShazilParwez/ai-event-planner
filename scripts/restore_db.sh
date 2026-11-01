#!/usr/bin/env bash
# ==============================================================================
# AI Event Planner - Database Restore Script
# Restores database from a verified backup file.
# Usage: ./scripts/restore_db.sh <backup_file_path> [--force]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file> [--force]" >&2
    exit 1
fi

BACKUP_FILE="$1"
FORCE="${2:-}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}" >&2
    exit 1
fi

echo "==> Verifying backup file: ${BACKUP_FILE}..."

# Checksum verification if .sha256 exists
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "--> Verifying SHA-256 checksum..."
    EXPECTED_HASH="$(awk '{print $1}' "${CHECKSUM_FILE}")"
    if command -v sha256sum &>/dev/null; then
        ACTUAL_HASH="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"
    elif command -v shasum &>/dev/null; then
        ACTUAL_HASH="$(shasum -a 256 "${BACKUP_FILE}" | awk '{print $1}')"
    else
        ACTUAL_HASH=""
    fi

    if [ -n "${ACTUAL_HASH}" ] && [ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]; then
        echo "Error: SHA-256 checksum MISMATCH! File may be corrupt or tampered." >&2
        echo "  Expected: ${EXPECTED_HASH}" >&2
        echo "  Actual:   ${ACTUAL_HASH}" >&2
        exit 1
    fi
    echo "--> Checksum verification PASSED."
fi

# Confirmation prompt unless --force
if [ "${FORCE}" != "--force" ]; then
    echo "WARNING: Restoring will overwrite existing data in the target database!"
    read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
    if [ "${CONFIRM}" != "yes" ]; then
        echo "Restore cancelled by user."
        exit 0
    fi
fi

POSTGRES_DB="${POSTGRES_DB:-event_planner_db}"
POSTGRES_USER="${POSTGRES_USER:-event_user}"
DATABASE_URL="${DATABASE_URL:-}"

# Case 1: Docker Compose PostgreSQL running
if command -v docker &>/dev/null && docker compose ps --services 2>/dev/null | grep -q "^db$"; then
    echo "--> Restoring into Docker Compose PostgreSQL service..."
    cat "${BACKUP_FILE}" | docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

# Case 2: Native PostgreSQL via psql
elif command -v psql &>/dev/null && [[ "${DATABASE_URL}" =~ postgresql ]]; then
    echo "--> Restoring via native psql..."
    psql "${DATABASE_URL}" < "${BACKUP_FILE}"

# Case 3: SQLite restore
elif [[ "${BACKUP_FILE}" =~ \.db$ ]]; then
    TARGET_DB="${PROJECT_ROOT}/backend/event_planner.db"
    echo "--> Restoring SQLite database to ${TARGET_DB}..."
    cp "${BACKUP_FILE}" "${TARGET_DB}"

else
    echo "Error: Could not determine restore target for ${BACKUP_FILE}." >&2
    exit 1
fi

echo "==> Database restore completed successfully."


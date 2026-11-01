#!/usr/bin/env bash
# ==============================================================================
# AI Event Planner - Database Migration Runner
# Executes Alembic migrations to upgrade the schema to the latest head revision.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Running database migrations (alembic upgrade head)..."

cd "${PROJECT_ROOT}/backend"

# Determine Python / Alembic execution target
if [ -d ".venv" ]; then
    PYTHON_CMD=".venv/bin/python"
    ALEMBIC_CMD=".venv/bin/alembic"
else
    PYTHON_CMD="python3"
    ALEMBIC_CMD="alembic"
fi

# Run migrations
${ALEMBIC_CMD} upgrade head

echo "==> Current migration status:"
${ALEMBIC_CMD} current

echo "==> Migrations applied successfully."


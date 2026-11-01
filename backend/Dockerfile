# ==============================================================================
# AI Event Planner - Backend Production Dockerfile
# Pinned Python 3.11 base, multi-stage build, unprivileged non-root user
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Dependencies
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --prefix=/install .

# ------------------------------------------------------------------------------
# Stage 2: Production Lean Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:/usr/local/bin:$PATH" \
    PYTHONPATH="/install/lib/python3.11/site-packages:/app"

# Install curl for container health check and libpq5 for PostgreSQL psycopg runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /install

# Create unprivileged non-root user and group (UID/GID 10001)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -d /app -M appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appgroup /app

# Copy application code and migrations
COPY --chown=appuser:appgroup alembic.ini .
COPY --chown=appuser:appgroup alembic ./alembic
COPY --chown=appuser:appgroup app ./app

# Drop to non-root user
USER appuser

EXPOSE 8000

# Liveness and readiness health probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/healthz || exit 1

# Production internal ASGI server with graceful shutdown handling
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "15", "--access-log"]

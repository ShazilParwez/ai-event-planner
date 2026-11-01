# AI Event Planner (PromptWars Challenge 5)

> A production-ready, GenAI-powered Event Planning Assistant engineered for Weddings, Birthdays, Corporate Gatherings, and Custom Celebrations. Built with clean architecture, strict TypeScript, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 16 / SQLite, psycopg 3, the official Google GenAI SDK, autonomous deterministic fallback resilience, multi-tenant security, and full containerization.

---

## 🌟 Key Features & Architectural Highlights

- **Multi-Event Type Specialization**: Domain heuristics and customized budgets for **Weddings**, **Birthdays**, **Corporate Events**, and **Custom Celebrations**.
- **AI Event Copilot**: Powered by Gemini (`gemini-2.5-flash`) via the official Google GenAI SDK (`google-genai`), featuring structured schema validation (`response_schema`), bounded retries with exponential jitter, and a strict 15-second total operation deadline.
- **100% High Availability (Autonomous Fallback)**: If Gemini is unreachable, rate-limited, or offline, the platform seamlessly degrades to a deterministic, rule-based planning engine without throwing user-facing errors.
- **Deterministic Budget Intelligence**: All budget calculations (category allocations, estimated spend, actual costs, variance, and over-budget thresholds) are computed using exact decimal arithmetic—strictly prohibiting AI math hallucinations or fabricated vendor pricing.
- **Verified Vendor Checklist**: Practical tracking pipeline for quotes, contracts, and contact notes with advance deposit ceiling constraints.
- **Timeline Sequencing**: Phased milestone planning combined with day-of minute-by-minute itinerary scheduling.
- **Guest Management & Dietary Matrix**: Tracks invitations, RSVPs, plus-ones, table assignments, and catering dietary restrictions with full PII protection.
- **Inspiration Studio**: Theme, decor, activity, and favor ideas curated and saved to event moodboards.
- **Secure Authentication & Multi-Tenancy**: Argon2id password hashing, JWT access tokens with version revocation, `HttpOnly`, `SameSite=Lax`, `Secure` refresh cookies over HTTPS, and strict tenant event isolation.
- **Production Infrastructure & Containerization**: Pinned multi-stage Docker builds (`python:3.11-slim`, `node:20-alpine`, `nginx:1.27-alpine`), PostgreSQL 16 Alpine with connection pooling, network segregation, and an Nginx reverse proxy gateway unifying frontend and API under the **exact same origin**.
- **Comprehensive CI/CD**: Automated GitHub Actions pipeline verifying linting, type safety, database migrations, unit tests, Docker builds, and backup integrity on every push and pull request.
- **Inclusive Accessibility System**: Dedicated Accessibility Hub covering 8 physical, sensory, cognitive, and mobility dimensions (`AccessibilityProfile`), verified venue checklists, step-free route guidance, timeline barrier detection (>90m sessions, sensory decompression breaks), emergency SOS support, zero attendee PII exposure, WCAG AAA high-contrast styling, dyslexia-friendly typography, and Web Speech API Text-to-Speech voice guidance (see [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)).

---

## 🏗️ Production Architecture & Orchestration

```text
                                [ Public Internet / HTTPS ]
                                             |
                                 (Port 80 / 443 / $GATEWAY_PORT)
                                             |
                         +-------------------v-------------------+
                         |       Nginx Reverse Proxy Gateway      |
                         |           (nginx:1.27-alpine)          |
                         +-------------------+-------------------+
                                             |
                   +-------------------------+-------------------------+
                   |                                                   |
             / (Frontend)                                         /api/ (Backend)
                   |                                                   |
       +-----------v-----------+                           +-----------v-----------+
       |   Frontend Static     |                           |   FastAPI ASGI App    |
       |     Asset Server      |                           |   (python:3.11-slim)  |
       |  (nginx:1.27-alpine)  |                           |   psycopg 3 / Argon2  |
       +-----------------------+                           +-----------+-----------+
                                                                       |
                                                           [ Isolated db_network ]
                                                                       |
                                                           +-----------v-----------+
                                                           |   PostgreSQL 16 DB    |
                                                           |  (postgres:16-alpine) |
                                                           |    Volume: pgdata     |
                                                           +-----------------------+
```

| Component | Technology | Role & Security Characteristics |
|---|---|---|
| **Gateway** | Nginx `1.27-alpine` | Single public entrypoint. Routes `/` to Frontend and `/api/` to Backend under the exact same origin. Enforces security headers, gzip, 15M body size, and 120s Copilot timeouts. |
| **Frontend** | React 18, Vite 5, Tailwind CSS | Multi-stage built SPA served by Nginx with SPA routing fallback (`try_files $uri $uri/ /index.html`). In-memory access token with zero JS exposure of refresh tokens. |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2.0 | Multi-stage image running as unprivileged `appuser` (UID 10001). Connects to PostgreSQL via modern psycopg 3. Automatic stale copilot action recovery on startup. |
| **Database** | PostgreSQL `16-alpine` | Relational storage on isolated `db_network` (no public host port binding). Persistent named volume `postgres_data`. Native `pg_isready` health checks. |
| **Local Dev** | SQLite (`event_planner.db`) | Instant zero-dependency development database supported alongside production PostgreSQL without code modifications. |

---

## 🚀 Quick Start with Docker Compose

### 1. Environment Configuration
Copy `.env.example` to `.env` and set your secrets:
```bash
cp .env.example .env
```
Key variables to verify:
- `SECRET_KEY`: Minimum 32-character cryptographically random string (e.g. `openssl rand -hex 32`).
- `POSTGRES_PASSWORD`: Secure database password.
- `GATEWAY_PORT`: Public HTTP port (defaults to `80`).
- `USE_MOCK_AI`: Set to `true` for offline/deterministic mock AI, or `false` with a `GEMINI_API_KEY`.

### 2. Start the Full Production Stack
```bash
docker compose up -d --build
```
Verify container statuses:
```bash
docker compose ps
```
The services will initialize with automated healthchecks:
- **Application UI**: `http://localhost/` (or `http://localhost:${GATEWAY_PORT}`)
- **API Health Liveness**: `http://localhost/api/v1/healthz`
- **Gateway Health**: `http://localhost/healthz`

### 3. Stop the Containers
```bash
docker compose down
```
*(To preserve database data, do not use `-v`. The `postgres_data` volume persists across restarts).*

---

## 💻 Standalone Local Development (Without Docker)

### Backend Setup (FastAPI & SQLite)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .\.venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Local API Docs: `http://localhost:8000/docs`
- Health Probe: `http://localhost:8000/api/v1/healthz`

### Frontend Setup (Vite & React)
```bash
cd frontend
pnpm install
pnpm run dev
```
- Local UI: `http://localhost:5173`

---

## 🛡️ Authentication, Cookies & Security Architecture

1. **Same-Origin Cookie Transmission**: By unifying the Frontend (`/`) and API (`/api/`) behind the Nginx reverse proxy gateway, all requests are strictly same-origin. Modern browsers deliver `SameSite=Lax; HttpOnly; Secure` cookies seamlessly on every fetch call without third-party subresource withholding.
2. **Refresh Token JS-Readability Block**: In production (`ENVIRONMENT=production`), the backend sets `refresh_token=None` in all API JSON responses. Refresh tokens exist solely in `HttpOnly` cookies scoped to `Path=/api/v1/auth`, completely mitigating XSS token extraction.
3. **CSRF Mitigation**:
   - `SameSite=Lax` cookies prevent cross-site form POST attacks.
   - `api-client.ts` attaches `X-Requested-With: XMLHttpRequest` to all requests, triggering browser CORS preflight on cross-origin callers.
4. **Tenant Isolation**: Every database query filters by `owner_id`. Cross-user access returns `404 Not Found` without disclosing resource existence.
5. **Session Revocation**: Refresh tokens carry unique cryptographic UUIDs (`jti`) and token versions (`token_version`). User password changes or global logouts immediately revoke all active sessions.

---

## 🛠️ Database Operations & Disaster Recovery

Operational scripts are provided in `scripts/` with cross-platform support (Bash and PowerShell):

### Run Migrations
```bash
# Bash
./scripts/run_migrations.sh

# PowerShell
.\scripts\run_migrations.ps1
```

### Database Backup
Creates a timestamped backup snapshot with a companion `.sha256` integrity checksum file in `backups/`:
```bash
# Bash
./scripts/backup_db.sh

# PowerShell
.\scripts\backup_db.ps1
```

### Database Restore
Restores from a verified snapshot, automatically validating the SHA-256 checksum before applying:
```bash
# Bash
./scripts/restore_db.sh backups/db_backup_20261101_120000.sql

# PowerShell
.\scripts\restore_db.ps1 -BackupFile backups\sqlite_backup_20261101_120000.db
```

### Automated Backup & Restore Verification Suite
Validates dump creation, SHA-256 verification, tampering detection, and row-level data parity against an isolated disposable database:
```bash
python scripts/test_backup_restore.py
```

---

## 🧪 Verification & Test Suites

### Backend Unit, Security & Hardening Tests (Pytest)
```bash
cd backend
pytest -q
```
- **Result**: **130 passed**, 1 skipped (live PostgreSQL), 0 failed across 14 test modules in ~17 seconds.
- Covers: Password hashing (Argon2id), JWT lifecycles, HttpOnly cookie authentication, tenant isolation, Alembic migrations, database connection pooling, circuit breaker failover, financial Decimal precision, Copilot conversation persistence, and atomic action approvals.

### Frontend Component & Integration Tests (Vitest)
```bash
cd frontend
pnpm test
pnpm run lint
pnpm run build
```
- **Result**: **67 passed** across 9 test suites in ~5 seconds.
- Zero TypeScript errors (`tsc --noEmit`).
- Production bundle compiled with Vite in ~4 seconds.

---

## 🔄 CI/CD Pipeline (GitHub Actions)

The repository includes a production GitHub Actions workflow (`.github/workflows/ci.yml`):

1. **`backend-ci`**: Python 3.11 environment, pip cache, Ruff linting, Mypy type-checking, Alembic migration consistency, and full Pytest execution with mock AI.
2. **`frontend-ci`**: Node.js 20 environment, pnpm frozen lockfile installation, TypeScript strict compilation check, Vitest unit testing, and Vite production bundle build.
3. **`infrastructure-ci`**: Docker Compose configuration validation (`docker compose config`), backend Dockerfile build, frontend Dockerfile build, Nginx gateway syntax verification (`nginx -t`), and automated database backup/restore integrity testing.

---

## 📄 License
MIT License. Crafted for PromptWars Challenge 5.

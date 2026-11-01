# ADR 0001: Monorepo Structure for Full-Stack Event Planner

## Status
Accepted

## Context
Challenge 5 requires developing an enterprise-quality AI Event Planning Assistant comprising a React frontend and Python FastAPI backend, supported by Docker containerization and continuous integration. We needed to decide whether to house frontend and backend in separate git repositories or organize them within a unified monorepo.

## Decision
We chose a clean frontend/backend monorepo layout:
- Root level: orchestration (`docker-compose.yml`), root `.env.example`, documentation, and architecture records.
- `/backend`: completely decoupled FastAPI service with independent `pyproject.toml`, virtual environment, migrations, and tests.
- `/frontend`: independent Vite + React + TypeScript application with isolated `package.json`, build pipeline, and tests.

## Consequences
- **Positive**:
  - Unified local development orchestration via `docker-compose up`.
  - Cohesive versioning and atomic commits across frontend and backend API contracts.
  - No secret leakage between layers.
- **Negative**:
  - Requires developers to maintain both Python and Node tooling locally (mitigated by Docker).


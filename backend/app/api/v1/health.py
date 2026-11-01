from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_ai_orchestrator, get_settings
from app.core.config import Settings
from app.schemas.common import HealthCheckResponse
from app.services.ai.orchestrator import AICopilotOrchestrator

router = APIRouter(tags=["Health & Monitoring"])


@router.get("/healthz", response_model=HealthCheckResponse, status_code=status.HTTP_200_OK)
async def liveness_check(
    settings: Settings = Depends(get_settings),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> HealthCheckResponse:
    """Basic liveness probe for container orchestrators."""
    return HealthCheckResponse(
        status="healthy",
        environment=settings.ENVIRONMENT,
        database_connected=True,
        ai_provider_mode=ai.mode,
        ai_circuit_breaker=ai.circuit_breaker_state,
        version="0.1.0",
    )


@router.get("/readyz", response_model=HealthCheckResponse, status_code=status.HTTP_200_OK)
async def readiness_check(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> HealthCheckResponse:
    """Readiness probe verifying DB connectivity and AI copilot readiness."""
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return HealthCheckResponse(
        status="ready" if db_ok else "degraded",
        environment=settings.ENVIRONMENT,
        database_connected=db_ok,
        ai_provider_mode=ai.mode,
        ai_circuit_breaker=ai.circuit_breaker_state,
        version="0.1.0",
    )


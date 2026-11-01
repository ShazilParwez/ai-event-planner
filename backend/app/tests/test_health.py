import asyncio
from app.api.v1.health import liveness_check, readiness_check
from app.core.config import get_settings
from app.services.ai.orchestrator import AICopilotOrchestrator


def test_liveness_check():
    settings = get_settings()
    ai = AICopilotOrchestrator()
    response = asyncio.run(liveness_check(settings=settings, ai=ai))
    assert response.status == "healthy"
    assert response.database_connected is True
    assert response.ai_provider_mode == "mock"


def test_readiness_check(db):
    settings = get_settings()
    ai = AICopilotOrchestrator()
    response = asyncio.run(readiness_check(db=db, settings=settings, ai=ai))
    assert response.status == "ready"
    assert response.database_connected is True

from fastapi import APIRouter
from app.api.v1 import (
    health_router,
    auth_router,
    events_router,
    copilot_router,
    budget_router,
    timeline_router,
    vendors_router,
    guests_router,
    inspiration_router,
    dashboard_router,
    accessibility_router,
)

api_router = APIRouter(prefix="/api/v1")

# Mount all feature routers
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(events_router)
api_router.include_router(copilot_router)
api_router.include_router(budget_router)
api_router.include_router(timeline_router)
api_router.include_router(vendors_router)
api_router.include_router(guests_router)
api_router.include_router(inspiration_router)
api_router.include_router(dashboard_router)
api_router.include_router(accessibility_router)


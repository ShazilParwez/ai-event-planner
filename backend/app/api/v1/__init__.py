from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.events import router as events_router
from app.api.v1.copilot import router as copilot_router
from app.api.v1.budget import router as budget_router
from app.api.v1.timeline import router as timeline_router
from app.api.v1.vendors import router as vendors_router
from app.api.v1.guests import router as guests_router
from app.api.v1.inspiration import router as inspiration_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.accessibility import router as accessibility_router

__all__ = [
    "health_router",
    "auth_router",
    "events_router",
    "copilot_router",
    "budget_router",
    "timeline_router",
    "vendors_router",
    "guests_router",
    "inspiration_router",
    "dashboard_router",
    "accessibility_router",
]


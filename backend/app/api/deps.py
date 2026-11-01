from functools import lru_cache
from typing import Generator, Optional
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer

from app.core.config import get_settings, Settings
from app.core.database import get_db
from app.core.security import decode_token
from app.core.rate_limit import copilot_rate_limiter, ai_plan_rate_limiter
from app.models.user import User
from app.models.event import Event
from app.services.ai.orchestrator import AICopilotOrchestrator

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@lru_cache()
def get_ai_orchestrator() -> AICopilotOrchestrator:
    """Singleton instance of AI Copilot Orchestrator."""
    return AICopilotOrchestrator()


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extracts, decodes, and validates JWT Bearer token, returning the authenticated User."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, malformed, or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Invalidate session if user's global session token_version has been incremented (e.g. password change)
    token_version = payload.get("token_version", 1)
    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been invalidated due to a security update or password change. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Attach to request.state for user-aware rate limiting
    request.state.user_id = user.id
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Verifies that the authenticated user account is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
    return current_user


def verify_event_access(
    db: Session,
    event_id: str,
    current_user: User,
) -> Event:
    """
    Enforces multi-tenant event boundary authorization.
    Verifies that the event exists AND is owned by the current user (or superuser).
    Guards against Insecure Direct Object Reference (IDOR) attacks across all domains.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found.",
        )

    # Authorization Check
    if event.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to access or modify this event.",
        )

    return event


def get_event_for_user(
    event_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Event:
    """FastAPI path-parameter dependency for event-scoped endpoints."""
    return verify_event_access(db=db, event_id=event_id, current_user=current_user)


__all__ = [
    "get_db",
    "get_ai_orchestrator",
    "get_settings",
    "get_current_user",
    "get_current_active_user",
    "verify_event_access",
    "get_event_for_user",
    "oauth2_scheme",
    "copilot_rate_limiter",
    "ai_plan_rate_limiter",
]

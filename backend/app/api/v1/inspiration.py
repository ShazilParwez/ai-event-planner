from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import (
    get_db,
    get_ai_orchestrator,
    get_current_active_user,
    get_event_for_user,
    verify_event_access,
    ai_plan_rate_limiter,
)
from app.models.event import Event
from app.models.user import User
from app.models.inspiration import InspirationCard
from app.schemas.common import StandardResponse
from app.schemas.inspiration import (
    InspirationCardResponse,
    InspirationCardCreate,
    InspirationCardUpdate,
    InspirationGenerateRequest,
    InspirationGenerateResponse,
)
from app.services.inspiration_service import InspirationService
from app.services.ai.orchestrator import AICopilotOrchestrator

router = APIRouter(tags=["Inspiration Studio"])


@router.get("/events/{event_id}/inspiration", response_model=StandardResponse[List[InspirationCardResponse]])
def get_inspiration_cards(
    category: Optional[str] = Query(default=None, description="Filter by category"),
    is_saved: Optional[bool] = Query(default=None, description="Filter by saved status"),
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[InspirationCardResponse]]:
    cards = InspirationService.list_inspiration_cards(
        db=db,
        event_id=event.id,
        category=category,
        is_saved=is_saved,
    )
    return StandardResponse(data=cards)


@router.post("/events/{event_id}/inspiration/generate", response_model=StandardResponse[InspirationGenerateResponse])
async def generate_inspiration_ideas(
    req: InspirationGenerateRequest,
    event: Event = Depends(get_event_for_user),
    _rate_limit: None = Depends(ai_plan_rate_limiter),
    db: Session = Depends(get_db),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> StandardResponse[InspirationGenerateResponse]:
    """Generates creative inspiration ideas for the event using AI with structured validation and deterministic fallback."""
    result = await InspirationService.generate_ideas(
        db=db,
        event_id=event.id,
        req=req,
        ai=ai,
    )
    return StandardResponse(
        message=f"Generated {len(result.ideas)} creative ideas",
        data=result,
    )


@router.post(
    "/events/{event_id}/inspiration/cards",
    response_model=StandardResponse[InspirationCardResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_custom_inspiration_card(
    card_in: InspirationCardCreate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[InspirationCardResponse]:
    card = InspirationService.create_inspiration_card(
        db=db,
        event_id=event.id,
        card_in=card_in,
    )
    return StandardResponse(
        message="Inspiration card saved to moodboard",
        data=card,
    )


@router.get("/events/{event_id}/inspiration/cards/{card_id}", response_model=StandardResponse[InspirationCardResponse])
def get_single_inspiration_card(
    card_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[InspirationCardResponse]:
    card = InspirationService.get_inspiration_card(db=db, event_id=event.id, card_id=card_id)
    return StandardResponse(data=InspirationCardResponse.model_validate(card))


@router.put("/events/{event_id}/inspiration/cards/{card_id}", response_model=StandardResponse[InspirationCardResponse])
def update_inspiration_card(
    card_id: str,
    card_in: InspirationCardUpdate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[InspirationCardResponse]:
    updated = InspirationService.update_inspiration_card(
        db=db,
        event_id=event.id,
        card_id=card_id,
        card_in=card_in,
    )
    return StandardResponse(
        message="Inspiration card updated",
        data=updated,
    )


@router.delete("/events/{event_id}/inspiration/cards/{card_id}", response_model=StandardResponse[None])
def delete_inspiration_card(
    card_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    InspirationService.delete_inspiration_card(db=db, event_id=event.id, card_id=card_id)
    return StandardResponse(message="Inspiration card removed")


@router.patch("/events/{event_id}/inspiration/cards/{card_id}/toggle-save", response_model=StandardResponse[InspirationCardResponse])
def toggle_save_inspiration_card(
    card_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[InspirationCardResponse]:
    updated = InspirationService.toggle_save_inspiration_card(db=db, event_id=event.id, card_id=card_id)
    status_label = "saved to" if updated.is_saved else "unsaved from"
    return StandardResponse(
        message=f"Card {status_label} moodboard",
        data=updated,
    )


# Backward-compatible route
@router.delete("/inspiration/cards/{card_id}", response_model=StandardResponse[None])
def delete_inspiration_card_legacy(
    card_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    card = db.query(InspirationCard).filter(InspirationCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Inspiration card not found.")
    verify_event_access(db, card.event_id, current_user)
    InspirationService.delete_inspiration_card(db=db, event_id=card.event_id, card_id=card_id)
    return StandardResponse(message="Inspiration card removed")

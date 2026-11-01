import json
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.event import EventType
from app.models.inspiration import InspirationCard, InspirationCategory, InspirationSource
from app.schemas.inspiration import (
    InspirationCardCreate,
    InspirationCardUpdate,
    InspirationCardResponse,
    InspirationGenerateRequest,
    GeneratedIdeaResponse,
    InspirationGenerateResponse,
)
from app.services.event_service import EventService
from app.services.ai.orchestrator import AICopilotOrchestrator


class InspirationService:
    @staticmethod
    def list_inspiration_cards(
        db: Session,
        event_id: str,
        category: Optional[str] = None,
        is_saved: Optional[bool] = None,
    ) -> List[InspirationCardResponse]:
        EventService.get_event(db, event_id)
        query = db.query(InspirationCard).filter(InspirationCard.event_id == event_id)

        if category and category.strip():
            cat = category.strip().lower()
            query = query.filter(InspirationCard.category.ilike(f"%{cat}%"))

        if is_saved is not None:
            query = query.filter(InspirationCard.is_saved == is_saved)

        cards = query.order_by(InspirationCard.created_at.desc()).all()
        return [InspirationCardResponse.model_validate(c) for c in cards]

    @staticmethod
    def get_inspiration_card(db: Session, event_id: str, card_id: str) -> InspirationCard:
        card = (
            db.query(InspirationCard)
            .filter(InspirationCard.id == card_id, InspirationCard.event_id == event_id)
            .first()
        )
        if not card:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inspiration card with id '{card_id}' not found for event '{event_id}'",
            )
        return card

    @staticmethod
    def create_inspiration_card(
        db: Session, event_id: str, card_in: InspirationCardCreate
    ) -> InspirationCardResponse:
        EventService.get_event(db, event_id)

        palette_str = None
        if card_in.color_palette:
            palette_str = json.dumps(card_in.color_palette)

        card = InspirationCard(
            event_id=event_id,
            title=card_in.title,
            category=card_in.category,
            description=card_in.description,
            tags=card_in.tags,
            color_palette=palette_str,
            suggested_budget_range=card_in.suggested_budget_range,
            notes=card_in.notes,
            is_ai_generated=card_in.is_ai_generated,
            is_saved=card_in.is_saved,
            source_type=card_in.source_type or (
                InspirationSource.AI_GENERATED.value
                if card_in.is_ai_generated
                else InspirationSource.USER.value
            ),
        )
        db.add(card)
        db.commit()
        db.refresh(card)

        return InspirationCardResponse.model_validate(card)

    @staticmethod
    def update_inspiration_card(
        db: Session, event_id: str, card_id: str, card_in: InspirationCardUpdate
    ) -> InspirationCardResponse:
        card = InspirationService.get_inspiration_card(db, event_id, card_id)

        update_data = card_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "color_palette":
                if value is not None:
                    setattr(card, "color_palette", json.dumps(value))
                else:
                    setattr(card, "color_palette", None)
            else:
                setattr(card, field, value)

        db.commit()
        db.refresh(card)

        return InspirationCardResponse.model_validate(card)

    @staticmethod
    def delete_inspiration_card(db: Session, event_id: str, card_id: str) -> None:
        card = InspirationService.get_inspiration_card(db, event_id, card_id)
        db.delete(card)
        db.commit()

    @staticmethod
    def toggle_save_inspiration_card(
        db: Session, event_id: str, card_id: str
    ) -> InspirationCardResponse:
        card = InspirationService.get_inspiration_card(db, event_id, card_id)
        card.is_saved = not card.is_saved
        db.commit()
        db.refresh(card)
        return InspirationCardResponse.model_validate(card)

    @staticmethod
    async def generate_ideas(
        db: Session,
        event_id: str,
        req: InspirationGenerateRequest,
        ai: AICopilotOrchestrator,
    ) -> InspirationGenerateResponse:
        event = EventService.get_event(db, event_id)

        try:
            ev_type = EventType(event.event_type)
        except Exception:
            ev_type = EventType.OTHER

        theme = req.custom_prompt or event.theme or event.title

        ai_ideas = await ai.generate_inspiration_ideas(
            event_type=ev_type,
            theme=theme,
            category=req.category,
            num_ideas=req.num_ideas,
        )

        idea_responses: List[GeneratedIdeaResponse] = []
        for item in ai_ideas:
            idea_responses.append(
                GeneratedIdeaResponse(
                    title=item.title,
                    category=item.category,
                    description=item.description,
                    tags=item.tags or [],
                    color_palette=item.color_palette or [],
                    suggested_budget_range=item.suggested_budget_range,
                    source_type="AI_GENERATED",
                )
            )

        source = "mock" if ai.settings.USE_MOCK_AI else ("gemini" if ai.circuit_breaker.can_attempt() else "deterministic_fallback")

        return InspirationGenerateResponse(
            ideas=idea_responses,
            disclaimer="Suggested budget ranges and ideas are creative, indicative estimates—not confirmed vendor quotations.",
            source=source,
        )


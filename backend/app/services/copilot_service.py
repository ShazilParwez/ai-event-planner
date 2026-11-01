import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.copilot import (
    CopilotThread,
    CopilotMessage,
    CopilotAction,
    CopilotRole,
    CopilotActionType,
    CopilotActionStatus,
)
from app.schemas.copilot import (
    CopilotThreadCreate,
    CopilotThreadResponse,
    CopilotMessageResponse,
    CopilotProposedAction,
    CopilotWarning,
    AICopilotChatResponse,
    CopilotActionExecuteResponse,
    CopilotActionDismissResponse,
)
from app.schemas.ai import AICopilotChatRequest
from app.schemas.timeline import TimelineMilestoneCreate
from app.schemas.budget import BudgetItemCreate
from app.schemas.vendor import VendorItemCreate, VendorItemUpdate
from app.services.event_service import EventService
from app.services.budget_service import BudgetService
from app.services.timeline_service import TimelineService
from app.services.vendor_service import VendorService
from app.services.copilot_context_builder import CopilotContextBuilder
from app.services.ai.orchestrator import AICopilotOrchestrator
from app.core.logging import logger

AUTHORIZED_ACTION_TYPES = {
    CopilotActionType.ADD_TIMELINE_MILESTONE.value,
    CopilotActionType.ADD_BUDGET_EXPENSE.value,
    CopilotActionType.ADD_VENDOR_ITEM.value,
}


class CopilotService:
    """Service managing AI Copilot conversation threads, messages, bounded context generation,
    and secure, user-approved action proposal execution."""

    # ---------------- Thread Operations ----------------

    @staticmethod
    def create_thread(
        db: Session, event_id: str, thread_in: Optional[CopilotThreadCreate] = None
    ) -> CopilotThread:
        EventService.get_event(db, event_id)
        title = thread_in.title if thread_in and thread_in.title else "New Chat"

        thread = CopilotThread(
            event_id=event_id,
            title=title,
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
        logger.info(f"Created CopilotThread '{thread.id}' for event '{event_id}'")
        return thread

    @staticmethod
    def list_threads(db: Session, event_id: str) -> List[CopilotThreadResponse]:
        EventService.get_event(db, event_id)
        threads = (
            db.query(CopilotThread)
            .filter(CopilotThread.event_id == event_id)
            .order_by(CopilotThread.updated_at.desc())
            .all()
        )

        responses: List[CopilotThreadResponse] = []
        for t in threads:
            msg_count = db.query(CopilotMessage).filter(CopilotMessage.thread_id == t.id).count()
            resp = CopilotThreadResponse(
                id=t.id,
                event_id=t.event_id,
                title=t.title,
                created_at=t.created_at,
                updated_at=t.updated_at,
                message_count=msg_count,
            )
            responses.append(resp)
        return responses

    @staticmethod
    def get_thread(db: Session, event_id: str, thread_id: str) -> CopilotThread:
        thread = (
            db.query(CopilotThread)
            .filter(CopilotThread.id == thread_id, CopilotThread.event_id == event_id)
            .first()
        )
        if not thread:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Copilot thread '{thread_id}' not found for event '{event_id}'.",
            )
        return thread

    @staticmethod
    def delete_thread(db: Session, event_id: str, thread_id: str) -> None:
        thread = CopilotService.get_thread(db, event_id, thread_id)
        db.delete(thread)
        db.commit()
        logger.info(f"Deleted CopilotThread '{thread_id}' from event '{event_id}'")

    # ---------------- Message Operations ----------------

    @staticmethod
    def list_messages(
        db: Session, event_id: str, thread_id: str
    ) -> List[CopilotMessageResponse]:
        CopilotService.get_thread(db, event_id, thread_id)
        messages = (
            db.query(CopilotMessage)
            .filter(
                CopilotMessage.thread_id == thread_id,
                CopilotMessage.event_id == event_id,
            )
            .order_by(CopilotMessage.created_at.asc())
            .all()
        )

        actions = (
            db.query(CopilotAction)
            .filter(
                CopilotAction.thread_id == thread_id,
                CopilotAction.event_id == event_id,
            )
            .order_by(CopilotAction.created_at.asc())
            .all()
        )

        responses: List[CopilotMessageResponse] = []
        for msg in messages:
            warnings_list = [
                CopilotWarning(**w) if isinstance(w, dict) else w
                for w in msg.parsed_warnings
            ]

            msg_actions: List[CopilotProposedAction] = []
            if msg.role == CopilotRole.ASSISTANT.value:
                for act in actions:
                    try:
                        act_type_enum = CopilotActionType(act.action_type)
                    except ValueError:
                        # Exclude any legacy unauthorized action types
                        continue

                    try:
                        act_status_enum = CopilotActionStatus(act.status)
                    except ValueError:
                        act_status_enum = CopilotActionStatus.PENDING

                    msg_actions.append(
                        CopilotProposedAction(
                            action_id=act.id,
                            action_type=act_type_enum,
                            title=act.title,
                            description=act.description,
                            parameters=act.parsed_parameters,
                            status=act_status_enum,
                        )
                    )

            resp = CopilotMessageResponse(
                id=msg.id,
                thread_id=msg.thread_id,
                event_id=msg.event_id,
                role=msg.role,
                content=msg.content,
                suggested_prompts=msg.parsed_suggested_prompts,
                warnings=warnings_list,
                proposed_actions=msg_actions,
                source=msg.source,
                created_at=msg.created_at,
            )
            responses.append(resp)
        return responses

    @staticmethod
    async def send_message(
        db: Session,
        event_id: str,
        thread_id: str,
        user_content: str,
        ai: AICopilotOrchestrator,
    ) -> AICopilotChatResponse:
        thread = CopilotService.get_thread(db, event_id, thread_id)

        # 1. Save user message
        user_msg = CopilotMessage(
            thread_id=thread.id,
            event_id=event_id,
            role=CopilotRole.USER.value,
            content=user_content,
            source="user",
        )
        db.add(user_msg)
        db.commit()

        # Update thread title if it's the first message
        if thread.title == "New Chat":
            thread.title = (
                user_content[:40] + "..." if len(user_content) > 40 else user_content
            )
            db.commit()

        # 2. Build Bounded Context with current message included
        bounded_context = CopilotContextBuilder.build_bounded_context(
            db, event_id, thread_id=thread.id, current_message=user_content
        )

        # 3. Call AI Orchestrator
        ai_req = AICopilotChatRequest(
            event_id=event_id,
            message=user_content,
        )
        ai_response: AICopilotChatResponse = await ai.chat_copilot(ai_req, bounded_context)

        # 4. Save Authorized Proposed Actions as PENDING in DB
        persisted_proposed_actions: List[CopilotProposedAction] = []
        for prop in ai_response.proposed_actions:
            # Enforce strict action scope: discard any unauthorized action types
            if prop.action_type.value not in AUTHORIZED_ACTION_TYPES:
                logger.warning(
                    f"Discarding unauthorized AI-proposed action type: '{prop.action_type}'"
                )
                continue

            db_action = CopilotAction(
                thread_id=thread.id,
                event_id=event_id,
                action_type=prop.action_type.value,
                title=prop.title,
                description=prop.description,
                parameters=json.dumps(prop.parameters),
                status=CopilotActionStatus.PENDING.value,
            )
            db.add(db_action)
            db.commit()
            db.refresh(db_action)

            # Rebind action_id to actual DB record ID
            persisted_proposed_actions.append(
                CopilotProposedAction(
                    action_id=db_action.id,
                    action_type=prop.action_type,
                    title=prop.title,
                    description=prop.description,
                    parameters=prop.parameters,
                    status=CopilotActionStatus.PENDING,
                )
            )

        # 5. Save assistant message
        warnings_payload = [w.model_dump() for w in ai_response.warnings]
        assistant_msg = CopilotMessage(
            thread_id=thread.id,
            event_id=event_id,
            role=CopilotRole.ASSISTANT.value,
            content=ai_response.response,
            suggested_prompts=json.dumps(ai_response.suggested_prompts),
            warnings=json.dumps(warnings_payload),
            source=ai_response.source,
        )
        db.add(assistant_msg)
        thread.updated_at = datetime.now(timezone.utc)
        db.commit()

        ai_response.proposed_actions = persisted_proposed_actions
        return ai_response

    # ---------------- Action Approval & Execution ----------------

    @staticmethod
    def execute_action(
        db: Session, event_id: str, action_id: str, thread_id: Optional[str] = None
    ) -> CopilotActionExecuteResponse:
        """Executes an AI-proposed action upon explicit user approval, delegating strictly
        to authorized domain services. Enforces concurrency protection and ensures failed
        executions leave the action in PENDING status without partial mutations."""
        action = (
            db.query(CopilotAction)
            .filter(CopilotAction.id == action_id, CopilotAction.event_id == event_id)
            .first()
        )
        if not action:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Action '{action_id}' not found for event '{event_id}'.",
            )

        # Verify thread ownership
        thread = (
            db.query(CopilotThread)
            .filter(CopilotThread.id == action.thread_id, CopilotThread.event_id == event_id)
            .first()
        )
        if not thread:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Thread associated with action '{action_id}' not found for event '{event_id}'.",
            )

        if thread_id and action.thread_id != thread_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Action '{action_id}' does not belong to thread '{thread_id}'.",
            )

        if action.status == CopilotActionStatus.EXECUTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Action has already been approved and executed.",
            )

        if action.status == CopilotActionStatus.DISMISSED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot execute an action that has been dismissed.",
            )

        if action.status != CopilotActionStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Action cannot be executed from status '{action.status}'.",
            )

        # Enforce authorized action scope
        if action.action_type not in AUTHORIZED_ACTION_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Unsupported action type '{action.action_type}'. Only "
                    f"{', '.join(sorted(AUTHORIZED_ACTION_TYPES))} are authorized."
                ),
            )

        # Concurrency safety: atomically transition PENDING -> EXECUTING
        # Ensures duplicate concurrent requests cannot execute the action simultaneously
        rows_updated = (
            db.query(CopilotAction)
            .filter(
                CopilotAction.id == action_id,
                CopilotAction.event_id == event_id,
                CopilotAction.status == CopilotActionStatus.PENDING.value,
            )
            .update({"status": "EXECUTING"}, synchronize_session="fetch")
        )
        if rows_updated == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Action is already being executed or was modified by a concurrent request.",
            )
        db.commit()

        event = EventService.get_event(db, event_id)
        params = action.parsed_parameters
        created_resource_id: Optional[str] = None
        details: Dict[str, Any] = {}

        try:
            if action.action_type == CopilotActionType.ADD_TIMELINE_MILESTONE.value:
                ms_data = TimelineMilestoneCreate(
                    title=params.get("title", action.title),
                    phase=params.get("phase", "GENERAL"),
                    priority=params.get("priority", "MEDIUM"),
                    description=params.get("description", action.description),
                    due_date=params.get("due_date") or params.get("target_date"),
                    order_index=int(params.get("order_index", 0)),
                )
                created_ms = TimelineService.create_milestone(db, event_id, ms_data)
                created_resource_id = created_ms.id
                details = {"milestone_id": created_ms.id, "title": created_ms.title}

            elif action.action_type == CopilotActionType.ADD_BUDGET_EXPENSE.value:
                cat_id = params.get("category_id")
                if not cat_id:
                    cat_name = params.get("category_name") or params.get("category")
                    categories = db.query(BudgetService.get_category.__globals__["BudgetCategory"]).filter(
                        BudgetService.get_category.__globals__["BudgetCategory"].event_id == event_id
                    ).all()

                    matched = None
                    if cat_name:
                        for c in categories:
                            if c.name.lower() in cat_name.lower() or cat_name.lower() in c.name.lower():
                                matched = c
                                break
                    if not matched and categories:
                        matched = categories[0]
                    elif not matched:
                        seeded = BudgetService.seed_default_categories(db, event)
                        matched = seeded[0]
                    cat_id = matched.id

                cost_val = params.get("estimated_cost") or params.get("cost") or params.get("actual_cost") or "0.00"
                item_data = BudgetItemCreate(
                    category_id=cat_id,
                    title=params.get("title") or params.get("name") or action.title,
                    estimated_cost=Decimal(str(cost_val)),
                    actual_cost=Decimal(str(params.get("actual_cost", "0.00"))),
                    paid_amount=Decimal(str(params.get("paid_amount", "0.00"))),
                    status=params.get("status", "ESTIMATED"),
                    notes=params.get("notes", action.description),
                )
                created_item = BudgetService.create_item(db, event_id, item_data)
                created_resource_id = created_item.id
                details = {
                    "item_id": created_item.id,
                    "title": created_item.title,
                    "estimated_cost": str(created_item.estimated_cost),
                }

            elif action.action_type == CopilotActionType.ADD_VENDOR_ITEM.value:
                target_vendor_id = params.get("vendor_id") or params.get("vendor_item_id")
                if target_vendor_id:
                    # Validate that target vendor item exists and belongs to this event
                    existing_vendor = VendorService.get_vendor(db, event_id, target_vendor_id)
                    update_fields: Dict[str, Any] = {}
                    if "status" in params and params["status"]:
                        update_fields["status"] = params["status"]
                    if "notes" in params and params["notes"]:
                        update_fields["notes"] = params["notes"]
                    if "name" in params and params["name"]:
                        update_fields["name"] = params["name"]
                    if "category" in params and params["category"]:
                        update_fields["category"] = params["category"]
                    if "estimated_quote" in params or "quoted_amount" in params:
                        q_val = params.get("estimated_quote") or params.get("quoted_amount")
                        update_fields["estimated_quote"] = Decimal(str(q_val)) if q_val is not None else None
                    if "final_agreed_price" in params or "agreed_cost" in params:
                        a_val = params.get("final_agreed_price") or params.get("agreed_cost")
                        update_fields["final_agreed_price"] = Decimal(str(a_val)) if a_val is not None else None
                    if "advance_paid" in params:
                        update_fields["advance_paid"] = Decimal(str(params["advance_paid"]))
                    if "contract_signed" in params:
                        update_fields["contract_signed"] = bool(params["contract_signed"])

                    update_payload = VendorItemUpdate(**update_fields)
                    persisted_vendor = VendorService.update_vendor(db, event_id, target_vendor_id, update_payload)
                    created_resource_id = persisted_vendor.id
                    details = {
                        "vendor_item_id": persisted_vendor.id,
                        "vendor_id": persisted_vendor.id,
                        "name": persisted_vendor.name,
                        "category": persisted_vendor.category,
                        "status": persisted_vendor.status,
                        "is_ai_suggested_checklist": persisted_vendor.is_ai_suggested_checklist,
                        "action": "updated",
                    }
                else:
                    quote_val = params.get("estimated_quote") or params.get("quoted_amount")
                    agreed_val = params.get("final_agreed_price") or params.get("agreed_cost")
                    vendor_data = VendorItemCreate(
                        category=params.get("category", "Other"),
                        name=params.get("name") or params.get("vendor_name") or action.title,
                        contact_name=params.get("contact_name") or params.get("contact_person"),
                        contact_email=params.get("contact_email"),
                        contact_phone=params.get("contact_phone"),
                        location=params.get("location"),
                        website=params.get("website"),
                        status=params.get("status", "DISCOVERING"),
                        estimated_quote=Decimal(str(quote_val)) if quote_val is not None else None,
                        final_agreed_price=Decimal(str(agreed_val)) if agreed_val is not None else None,
                        advance_paid=Decimal(str(params.get("advance_paid", "0.00"))),
                        contract_signed=bool(params.get("contract_signed", False)),
                        notes=params.get("notes", action.description),
                        is_ai_suggested_checklist=True,
                    )
                    persisted_vendor = VendorService.create_vendor_item(db, event_id, vendor_data)
                    created_resource_id = persisted_vendor.id
                    details = {
                        "vendor_item_id": persisted_vendor.id,
                        "vendor_id": persisted_vendor.id,
                        "name": persisted_vendor.name,
                        "category": persisted_vendor.category,
                        "status": persisted_vendor.status,
                        "is_ai_suggested_checklist": True,
                        "action": "created",
                    }

            # Transactional success: update status to EXECUTED and record timestamp
            action.status = CopilotActionStatus.EXECUTED.value
            action.executed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(action)

        except HTTPException as he:
            # Domain service failure: rollback partial mutations and preserve PENDING status
            db.rollback()
            db.query(CopilotAction).filter(CopilotAction.id == action_id).update(
                {"status": CopilotActionStatus.PENDING.value, "executed_at": None}
            )
            db.commit()
            raise he
        except Exception as exc:
            # Parameter validation or unhandled error: rollback and preserve PENDING status
            db.rollback()
            db.query(CopilotAction).filter(CopilotAction.id == action_id).update(
                {"status": CopilotActionStatus.PENDING.value, "executed_at": None}
            )
            db.commit()
            logger.error(f"Failed to execute action '{action_id}': {str(exc)}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Action parameter validation or domain constraint failed: {str(exc)}",
            )

        logger.info(
            f"Successfully executed action '{action_id}' of type '{action.action_type}' for event '{event_id}'"
        )
        return CopilotActionExecuteResponse(
            action_id=action.id,
            status=CopilotActionStatus.EXECUTED.value,
            action_type=action.action_type,
            created_resource_id=created_resource_id,
            details=details,
            message=f"Action '{action.title}' approved and executed successfully.",
        )

    @staticmethod
    def dismiss_action(
        db: Session, event_id: str, action_id: str, thread_id: Optional[str] = None
    ) -> CopilotActionDismissResponse:
        """Dismisses an AI-proposed action."""
        action = (
            db.query(CopilotAction)
            .filter(CopilotAction.id == action_id, CopilotAction.event_id == event_id)
            .first()
        )
        if not action:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Action '{action_id}' not found for event '{event_id}'.",
            )

        thread = (
            db.query(CopilotThread)
            .filter(CopilotThread.id == action.thread_id, CopilotThread.event_id == event_id)
            .first()
        )
        if not thread:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Thread associated with action '{action_id}' not found for event '{event_id}'.",
            )

        if thread_id and action.thread_id != thread_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Action '{action_id}' does not belong to thread '{thread_id}'.",
            )

        if action.status == CopilotActionStatus.EXECUTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot dismiss an action that has already been executed.",
            )

        action.status = CopilotActionStatus.DISMISSED.value
        action.executed_at = None
        db.commit()

        logger.info(f"Dismissed CopilotAction '{action_id}' for event '{event_id}'")
        return CopilotActionDismissResponse(
            action_id=action.id,
            status=CopilotActionStatus.DISMISSED.value,
            message=f"Action '{action.title}' dismissed.",
        )

    @staticmethod
    def recover_stale_actions(db: Session, event_id: Optional[str] = None) -> int:
        """Recovers any stale or orphan EXECUTING actions back to PENDING status,
        ensuring actions never become permanently stuck across worker restarts or network disruptions."""
        query = db.query(CopilotAction).filter(CopilotAction.status == "EXECUTING")
        if event_id:
            query = query.filter(CopilotAction.event_id == event_id)
        count = query.update(
            {"status": CopilotActionStatus.PENDING.value, "executed_at": None},
            synchronize_session="fetch",
        )
        db.commit()
        if count > 0:
            logger.info(f"Recovered {count} stale EXECUTING CopilotAction(s) back to PENDING status.")
        return count

    @staticmethod
    def reset_action(
        db: Session, event_id: str, action_id: str, thread_id: Optional[str] = None
    ) -> CopilotAction:
        """Resets an action in EXECUTING status back to clean PENDING status."""
        action = (
            db.query(CopilotAction)
            .filter(CopilotAction.id == action_id, CopilotAction.event_id == event_id)
            .first()
        )
        if not action:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Action '{action_id}' not found for event '{event_id}'.",
            )
        if thread_id and action.thread_id != thread_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Action '{action_id}' does not belong to thread '{thread_id}'.",
            )
        if action.status == CopilotActionStatus.EXECUTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reset an action that has already been executed.",
            )
        if action.status == CopilotActionStatus.DISMISSED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reset an action that has been dismissed.",
            )
        action.status = CopilotActionStatus.PENDING.value
        action.executed_at = None
        db.commit()
        db.refresh(action)
        return action

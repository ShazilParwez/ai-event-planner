from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.copilot import CopilotMessage
from app.services.event_service import EventService
from app.services.budget_service import BudgetService
from app.services.timeline_service import TimelineService
from app.services.vendor_service import VendorService
from app.services.guest_service import GuestService
from app.services.inspiration_service import InspirationService


class CopilotContextBuilder:
    """Constructs a bounded, token-efficient, sanitized event context snapshot for AI Copilot prompts."""

    @staticmethod
    def build_bounded_context(
        db: Session,
        event_id: str,
        thread_id: Optional[str] = None,
        current_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        event: Event = EventService.get_event(db, event_id)

        # 1. Core Event Metadata
        context: Dict[str, Any] = {
            "event": {
                "id": event.id,
                "title": event.title,
                "event_type": event.event_type,
                "location": event.location,
                "start_date": event.start_date.isoformat() if event.start_date else None,
                "end_date": event.end_date.isoformat() if event.end_date else None,
                "target_budget": float(event.target_budget),
                "currency": event.currency or "INR",
                "expected_guest_count": event.expected_guest_count,
                "status": event.status,
            }
        }

        # 2. Budget Snapshot
        try:
            budget_ov = BudgetService.calculate_overview(event, db)
            top_categories = []
            for cat in sorted(budget_ov.categories, key=lambda c: c.allocated_amount, reverse=True)[:5]:
                top_categories.append({
                    "name": cat.name,
                    "allocated": float(cat.allocated_amount),
                    "spent": float(cat.total_actual or cat.total_estimated),
                })

            context["budget"] = {
                "target_budget": float(budget_ov.target_budget),
                "total_allocated": float(budget_ov.total_allocated),
                "total_committed": float(budget_ov.total_actual or budget_ov.total_estimated),
                "total_paid": float(budget_ov.total_paid),
                "remaining_budget": float(budget_ov.remaining_budget),
                "is_over_budget": budget_ov.is_over_budget,
                "top_categories": top_categories,
            }
        except Exception:
            context["budget"] = {
                "target_budget": float(event.target_budget),
                "is_over_budget": False,
                "top_categories": [],
            }

        # 3. Timeline Snapshot
        try:
            timeline_ov = TimelineService.get_timeline_overview(db, event.id)
            pending_milestones = [
                {
                    "title": ms.title,
                    "phase": ms.phase,
                    "priority": ms.priority,
                    "due_date": ms.due_date.isoformat() if ms.due_date else None,
                    "is_overdue": ms.is_overdue,
                }
                for ms in timeline_ov.milestones
                if ms.status != "COMPLETED"
            ][:3]

            next_activities = [
                {
                    "title": act.title,
                    "start_time": act.start_time,
                    "end_time": act.end_time,
                }
                for act in timeline_ov.activities[:2]
            ]

            context["timeline"] = {
                "total_milestones": timeline_ov.total_milestones,
                "completed_milestones": timeline_ov.completed_milestones,
                "overdue_milestones": timeline_ov.overdue_milestones,
                "completion_percentage": timeline_ov.completion_percentage,
                "next_pending_milestones": pending_milestones,
                "upcoming_activities": next_activities,
            }
        except Exception:
            context["timeline"] = {
                "total_milestones": 0,
                "completed_milestones": 0,
                "overdue_milestones": 0,
                "next_pending_milestones": [],
            }

        # 4. Vendor Procurement Snapshot
        try:
            vendor_sum = VendorService.get_vendor_summary(db, event.id)
            context["vendors"] = {
                "total_vendors": vendor_sum.total_vendors,
                "booked_vendors": vendor_sum.booked_vendors,
                "pending_vendors": vendor_sum.pending_vendors,
                "total_contracted_spend": float(vendor_sum.total_contracted_spend),
                "total_advance_paid": float(vendor_sum.total_advance_paid),
                "total_remaining_payment": float(vendor_sum.total_remaining_payment),
            }
        except Exception:
            context["vendors"] = {
                "total_vendors": 0,
                "booked_vendors": 0,
                "total_contracted_spend": 0.0,
            }

        # 5. Guest & Catering Snapshot (Privacy preserved: aggregate metrics only)
        try:
            guest_an = GuestService.get_guest_analytics(db, event.id)
            # Filter non-zero dietary allocations
            dietary_allocations = {
                k: v for k, v in guest_an.dietary_preference_distribution.items() if v > 0
            }
            context["guests"] = {
                "total_invited": guest_an.total_invited,
                "confirmed_guests": guest_an.confirmed_guests,
                "expected_attendance": guest_an.expected_attendance,
                "attendance_rate": guest_an.attendance_rate,
                "dietary_needs": dietary_allocations,
            }
        except Exception:
            context["guests"] = {
                "total_invited": 0,
                "confirmed_guests": 0,
                "expected_attendance": event.expected_guest_count,
                "dietary_needs": {},
            }

        # 6. Inspiration Moodboard Snapshot
        try:
            saved_cards = InspirationService.list_inspiration_cards(db, event.id, is_saved=True)
            concept_snippets = [
                {"title": c.title, "category": c.category}
                for c in saved_cards[:3]
            ]
            context["inspiration"] = {
                "saved_card_count": len(saved_cards),
                "top_concepts": concept_snippets,
            }
        except Exception:
            context["inspiration"] = {
                "saved_card_count": 0,
                "top_concepts": [],
            }

        # 7. Rolling Dialogue Window (Last 6 messages)
        if thread_id:
            recent_msgs = (
                db.query(CopilotMessage)
                .filter(CopilotMessage.thread_id == thread_id)
                .order_by(CopilotMessage.created_at.desc(), CopilotMessage.id.desc())
                .limit(6)
                .all()
            )
            # Reverse to chronological order
            dialogue_history = [
                {
                    "role": msg.role,
                    "content": msg.content[:300] if len(msg.content) > 300 else msg.content,
                }
                for msg in reversed(recent_msgs)
            ]
            context["recent_dialogue"] = dialogue_history
        else:
            context["recent_dialogue"] = []

        if current_message:
            context["current_user_message"] = current_message

        return context


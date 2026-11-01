import uuid
from decimal import Decimal
from typing import List, Optional, Dict, Any
from app.models.event import EventType
from app.schemas.ai import (
    AICopilotEventGenerationRequest,
    AICopilotFullPlanResponse,
    AIBudgetPlanResponse,
    AICategoryAllocation,
    AITimelinePlanResponse,
    AIMilestonePlan,
    AIVendorChecklistRecommendation,
    AIInspirationIdea,
    AICopilotChatRequest,
)
from app.schemas.copilot import (
    CopilotProposedAction,
    CopilotWarning,
    CopilotActionType,
    CopilotActionStatus,
    AICopilotChatResponse,
)

# Deterministic category distribution ratios by event type
EVENT_BUDGET_RATIOS: Dict[EventType, List[Dict[str, Any]]] = {
    EventType.WEDDING: [
        {"name": "Venue & Catering", "pct": Decimal("45.00"), "items": ["Venue Rental", "Plated Dinner or Buffet", "Beverages/Bar Package"]},
        {"name": "Photography & Videography", "pct": Decimal("15.00"), "items": ["Lead Photographer", "Videographer", "Photo Album"]},
        {"name": "Music & Entertainment", "pct": Decimal("10.00"), "items": ["DJ or Live Band", "Sound Equipment", "Emcee"]},
        {"name": "Floral & Decor", "pct": Decimal("12.00"), "items": ["Centerpieces", "Ceremony Arch", "Bouquets & Boutonnieres", "Lighting"]},
        {"name": "Attire & Beauty", "pct": Decimal("8.00"), "items": ["Attire & Alterations", "Hair & Makeup"]},
        {"name": "Stationery & Favors", "pct": Decimal("5.00"), "items": ["Invitations & Postage", "Place Cards", "Guest Favors"]},
        {"name": "Emergency Contingency", "pct": Decimal("5.00"), "items": ["Unforeseen Fees & Overtime Buffer"]},
    ],
    EventType.BIRTHDAY: [
        {"name": "Venue & Rental", "pct": Decimal("25.00"), "items": ["Hall or Private Room Rental", "Tables & Chairs"]},
        {"name": "Food & Birthday Cake", "pct": Decimal("40.00"), "items": ["Catering / Food Truck", "Custom Cake", "Refreshments & Snacks"]},
        {"name": "Entertainment & Activities", "pct": Decimal("20.00"), "items": ["DJ / Performer / Entertainer", "Games & Prizes"]},
        {"name": "Decorations & Theme Favors", "pct": Decimal("10.00"), "items": ["Balloon Garland", "Backdrop Banner", "Favor Bags"]},
        {"name": "Contingency Fund", "pct": Decimal("5.00"), "items": ["Last-minute Supplies"]},
    ],
    EventType.COMMUNITY: [
        {"name": "Permits, Venue & Facilities", "pct": Decimal("30.00"), "items": ["Municipal Permit", "Park / Hall Rental", "Restroom Facilities"]},
        {"name": "Food & Hydration", "pct": Decimal("25.00"), "items": ["Community Refreshments", "Water Stations", "Compostable Tableware"]},
        {"name": "Audio/Visual & Logistics", "pct": Decimal("25.00"), "items": ["PA System & Microphones", "Tents & Canopies", "Waste Bins"]},
        {"name": "Signage & Outreach", "pct": Decimal("12.00"), "items": ["Welcome Banners", "Directional Signs", "Flyers / Badges"]},
        {"name": "First Aid & Safety", "pct": Decimal("8.00"), "items": ["First Aid Supplies", "Safety Vest & Communication Radios"]},
    ],
    EventType.OTHER: [
        {"name": "Venue & Facilities", "pct": Decimal("35.00"), "items": ["Venue Space Rental", "Tables & Chairs", "Setup & Cleanup"]},
        {"name": "Food & Beverages", "pct": Decimal("30.00"), "items": ["Catering Services", "Beverages & Refreshments"]},
        {"name": "Audio/Visual & Equipment", "pct": Decimal("15.00"), "items": ["Sound System", "Microphones", "Projection Equipment"]},
        {"name": "Decorations & Signage", "pct": Decimal("12.00"), "items": ["Theme Decor", "Event Signage", "Badges & Collateral"]},
        {"name": "Contingency Buffer", "pct": Decimal("8.00"), "items": ["Emergency & Incidental Expenses"]},
    ],
}


def generate_fallback_budget(
    event_type: EventType, target_budget: Decimal, guest_count: int
) -> AIBudgetPlanResponse:
    ratios = EVENT_BUDGET_RATIOS.get(event_type, EVENT_BUDGET_RATIOS[EventType.COMMUNITY])
    allocations: List[AICategoryAllocation] = []

    for item in ratios:
        pct = item["pct"]
        amount = (target_budget * pct) / Decimal("100.00")
        allocations.append(
            AICategoryAllocation(
                category_name=item["name"],
                percentage=pct,
                suggested_amount=amount.quantize(Decimal("0.01")),
                rationale=f"Standard benchmark allocation ({pct}%) for {event_type.value.lower()} planning.",
                recommended_items=item["items"],
            )
        )

    tips = [
        "Prioritize the largest expense category first before committing to decorative add-ons.",
        "Always maintain the 5% contingency buffer for last-minute taxes, gratuities, and deliveries.",
        f"For a guest list of {guest_count}, track per-person catering quotes closely to avoid budget creep.",
    ]

    return AIBudgetPlanResponse(
        event_type=event_type,
        total_budget=target_budget,
        currency="INR",
        allocations=allocations,
        cost_saving_tips=tips,
        disclaimer="Deterministic fallback generated based on industry benchmark percentage models.",
    )


def generate_fallback_timeline(event_type: EventType) -> AITimelinePlanResponse:
    if event_type == EventType.WEDDING:
        milestones = [
            AIMilestonePlan(
                title="Secure Venue and Key Vendors",
                phase="9-12_MONTHS_BEFORE",
                recommended_timeline="9-12 Months Prior",
                key_tasks=["Finalize date and guest estimate", "Tour and book ceremony & reception venues", "Hire lead photographer"],
            ),
            AIMilestonePlan(
                title="Send Invitations & Confirm Menus",
                phase="4-6_MONTHS_BEFORE",
                recommended_timeline="4-6 Months Prior",
                key_tasks=["Mail formal invitations", "Menu tasting and dietary accommodation planning", "Book music/DJ"],
            ),
            AIMilestonePlan(
                title="Final RSVPs & Seating Layout",
                phase="1-2_MONTHS_BEFORE",
                recommended_timeline="1-2 Months Prior",
                key_tasks=["Lock in final guest headcount with caterer", "Draft table seating chart", "Confirm timeline with vendor team"],
            ),
            AIMilestonePlan(
                title="Event Week & Day-of Execution",
                phase="EVENT_WEEK",
                recommended_timeline="Week of Event",
                key_tasks=["Pack day-of emergency kit", "Host ceremony rehearsal", "Review minute-by-minute vendor cue sheet"],
            ),
        ]
        sample_schedule = [
            {"time": "14:00", "task": "Vendor arrivals, floral setup, and sound checks"},
            {"time": "16:00", "task": "Ceremony processional and nuptials"},
            {"time": "17:00", "task": "Cocktail hour & family portraits"},
            {"time": "18:30", "task": "Grand entrance & dinner service"},
            {"time": "20:00", "task": "Speeches, first dance, and open dance floor"},
            {"time": "22:30", "task": "Grand farewell and tear-down"},
        ]
    elif event_type == EventType.BIRTHDAY:
        milestones = [
            AIMilestonePlan(
                title="Set Date, Theme & Venue",
                phase="6-8_WEEKS_BEFORE",
                recommended_timeline="6-8 Weeks Prior",
                key_tasks=["Choose theme and activity concept", "Reserve venue space or clean home", "Create draft invite list"],
            ),
            AIMilestonePlan(
                title="Order Cake & Send Invitations",
                phase="3-4_WEEKS_BEFORE",
                recommended_timeline="3-4 Weeks Prior",
                key_tasks=["Send digital or paper invites", "Order themed custom cake", "Purchase interactive decorations"],
            ),
            AIMilestonePlan(
                title="Final Prep & RSVP Confirmation",
                phase="1_WEEK_BEFORE",
                recommended_timeline="1 Week Prior",
                key_tasks=["Confirm total headcount", "Purchase groceries / confirm catering", "Prepare playlist and games"],
            ),
        ]
        sample_schedule = [
            {"time": "15:00", "task": "Host and decoration team setup"},
            {"time": "16:00", "task": "Guest arrival, welcome drinks, and icebreakers"},
            {"time": "17:00", "task": "Party games and main interactive activity"},
            {"time": "18:15", "task": "Dinner/snacks and cake cutting song"},
            {"time": "19:30", "task": "Goodie bags and guest departure"},
        ]
    else: # COMMUNITY
        milestones = [
            AIMilestonePlan(
                title="Permit Approval & Stakeholder Alignment",
                phase="2-3_MONTHS_BEFORE",
                recommended_timeline="8-12 Weeks Prior",
                key_tasks=["File city/park permits", "Organize volunteer committees", "Draft event safety plan"],
            ),
            AIMilestonePlan(
                title="Equipment Logistics & Public Promotion",
                phase="3-4_WEEKS_BEFORE",
                recommended_timeline="3-4 Weeks Prior",
                key_tasks=["Reserve audio gear and tents", "Publish local event flyers and social campaigns", "Confirm volunteer shifts"],
            ),
            AIMilestonePlan(
                title="Logistics Walkthrough & Event Setup",
                phase="WEEK_OF_EVENT",
                recommended_timeline="Week of Event",
                key_tasks=["Conduct site walkthrough", "Confirm sanitation stations and signage", "Setup early on event morning"],
            ),
        ]
        sample_schedule = [
            {"time": "08:00", "task": "Volunteer briefing, tent and audio setup"},
            {"time": "10:00", "task": "Welcome gates open, information booth active"},
            {"time": "11:30", "task": "Community keynote and performances"},
            {"time": "13:00", "task": "Interactive booths, activities, and food stalls"},
            {"time": "16:00", "task": "Closing remarks and volunteer clean-up sweep"},
        ]

    return AITimelinePlanResponse(
        event_type=event_type,
        milestones=milestones,
        day_of_schedule_sample=sample_schedule,
    )


def generate_fallback_vendor_checklists(event_type: EventType) -> List[AIVendorChecklistRecommendation]:
    if event_type == EventType.WEDDING:
        return [
            AIVendorChecklistRecommendation(
                category="Venue",
                recommended_checklist=["Review noise curfew rules", "Verify liquor license policy", "Confirm setup/teardown hours"],
                questions_to_ask_vendor=["What is your weather contingency plan for outdoor areas?", "Are tables and chairs included in the fee?"],
                booking_urgency="HIGH",
            ),
            AIVendorChecklistRecommendation(
                category="Catering",
                recommended_checklist=["Schedule tasting session", "Confirm dietary handling (gluten-free, vegan, nut allergies)", "Verify staffing ratio"],
                questions_to_ask_vendor=["Do you handle cake cutting and plate clearing?", "Is tableware and linen rental included?"],
                booking_urgency="HIGH",
            ),
            AIVendorChecklistRecommendation(
                category="Photography",
                recommended_checklist=["Review full wedding galleries (not just highlights)", "Check second shooter availability", "Sign copyright & delivery agreement"],
                questions_to_ask_vendor=["What is the turnaround time for the digital gallery?", "Do you carry liability insurance?"],
                booking_urgency="HIGH",
            ),
        ]
    elif event_type == EventType.BIRTHDAY:
        return [
            AIVendorChecklistRecommendation(
                category="Bakery / Cake Artist",
                recommended_checklist=["Choose cake flavor and tier size", "Review allergen-free alternatives", "Confirm delivery time slot"],
                questions_to_ask_vendor=["Does delivery include setup on the cake stand?", "How many hours before the event can the cake sit out?"],
                booking_urgency="MEDIUM",
            ),
            AIVendorChecklistRecommendation(
                category="Entertainment",
                recommended_checklist=["Specify preferred songs/genres", "Confirm electrical outlet requirements", "Provide age range of guests"],
                questions_to_ask_vendor=["Do you bring your own sound and lighting setup?", "Do you take live guest requests?"],
                booking_urgency="MEDIUM",
            ),
        ]
    else:
        return [
            AIVendorChecklistRecommendation(
                category="Logistics & Rentals",
                recommended_checklist=["Order heavy-duty canopies and weighted sandbags", "Confirm portable restroom delivery and servicing", "Verify public address system clarity"],
                questions_to_ask_vendor=["What is the delivery window and collection policy?", "Is an on-site technician available during the event?"],
                booking_urgency="HIGH",
            )
        ]


def generate_fallback_inspiration(event_type: EventType, theme: Optional[str]) -> List[AIInspirationIdea]:
    theme_title = theme or "Royal Heritage & Contemporary Elegance"
    if event_type == EventType.WEDDING:
        return [
            AIInspirationIdea(
                title=f"{theme_title}: Warm Ambient Candlelight & Marigold Canopies",
                category="Decorations",
                description="Cluster pillar candles of varying heights on brass urlis accented with fresh orange and yellow marigold garlands and eucalyptus sprigs.",
                tags=["decor", "lighting", "traditional", "romantic"],
                color_palette=["#FF9933", "#D4AF37", "#800020", "#FFFDD0"],
                suggested_budget_range="₹60,000 - ₹1,20,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Imperial Velvet & Gold Leaf Color Palette",
                category="Color Palettes",
                description="Rich deep burgundy and emerald green tones accented by warm champagne gold and antique ivory silks.",
                tags=["colors", "palette", "royal", "aesthetic"],
                color_palette=["#800020", "#1B4D3E", "#D4AF37", "#F5F5DC"],
                suggested_budget_range="₹30,000 - ₹50,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Interactive Live Sangeet Folk Fusion & Dhol Troupes",
                category="Entertainment",
                description="High-energy acoustic sufi folk ensemble transitioned into dynamic dhol performances for the grand entrance.",
                tags=["music", "performance", "sangeet", "dhol"],
                color_palette=["#FF4500", "#FFD700", "#8A2BE2"],
                suggested_budget_range="₹75,000 - ₹1,50,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Live Chaat Street Bazaar & Artisanal Dessert Bar",
                category="Catering and Menus",
                description="Interactive food pavilions serving Delhi-style golgappas, customized kulfi falooda, and warm saffron jalebis.",
                tags=["catering", "street-food", "interactive", "dessert"],
                color_palette=["#E25822", "#FFD700", "#7C0A02"],
                suggested_budget_range="₹1,20,000 - ₹2,50,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Golden Hour Portraiture with Sheesh Mahal Backdrops",
                category="Photography Concepts",
                description="Candid pre-sunset silhouettes utilizing architectural archways, intricate jharokhas, and reflective water features.",
                tags=["photography", "candid", "golden-hour", "architecture"],
                color_palette=["#FF8C00", "#DAA520", "#2F4F4F"],
                suggested_budget_range="₹50,000 - ₹1,00,000 (Indicative)",
            ),
        ]
    elif event_type == EventType.BIRTHDAY:
        return [
            AIInspirationIdea(
                title=f"{theme_title}: Retro Neon Arcade & Polaroid Memory Wall",
                category="Event Themes",
                description="Vibrant neon LED signage, retro gaming kiosks, and an instant film photo-snapping wall with metallic markers.",
                tags=["neon", "arcade", "retro", "interactive"],
                color_palette=["#FF1493", "#00FFFF", "#39FF14", "#1F1B24"],
                suggested_budget_range="₹35,000 - ₹70,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Pastel Dream Balloon Clouds & Shimmer Walls",
                category="Decorations",
                description="Organic cascade of pastel lavender, blush pink, and metallic rose gold balloon arches flanking an iridescent backdrop.",
                tags=["balloons", "decor", "pastel", "glamour"],
                color_palette=["#E6E6FA", "#FFB6C1", "#B76E79", "#FFFFFF"],
                suggested_budget_range="₹25,000 - ₹45,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Signature Mocktail Lab & Molecular Dessert Bar",
                category="Catering and Menus",
                description="Custom misting mocktails served with smoking dry ice, fresh herb infusions, and personalized edible monogram stirrers.",
                tags=["beverages", "dessert", "mocktails", "presentation"],
                color_palette=["#00CED1", "#FF69B4", "#FFF8DC"],
                suggested_budget_range="₹40,000 - ₹80,000 (Indicative)",
            ),
        ]
    else:
        return [
            AIInspirationIdea(
                title="Collaborative Neighborhood Mosaic & Art Canvas",
                category="Activities",
                description="A community participatory mural canvas where local families contribute painted tiles representing cultural unity.",
                tags=["community", "art", "inclusive", "interactive"],
                color_palette=["#2E8B57", "#4682B4", "#DAA520", "#CD853F"],
                suggested_budget_range="₹15,000 - ₹35,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Eco-Friendly Bamboo Pavilions & Solar Lanterns",
                category="Decorations",
                description="Sustainable locally-crafted bamboo canopies illuminated by warm solar fairy lanterns and compostable signage.",
                tags=["sustainability", "eco-friendly", "solar", "decor"],
                color_palette=["#228B22", "#D2B48C", "#FFF8DC", "#2F4F4F"],
                suggested_budget_range="₹20,000 - ₹50,000 (Indicative)",
            ),
            AIInspirationIdea(
                title="Local Harvest Potluck & Regional Cuisine Showcases",
                category="Catering and Menus",
                description="Celebration of neighborhood food cultures featuring organic farm-to-table grazing tables and zero-waste packaging.",
                tags=["potluck", "farm-to-table", "zero-waste", "catering"],
                color_palette=["#556B2F", "#8B4513", "#F4A460"],
                suggested_budget_range="₹30,000 - ₹60,000 (Indicative)",
            ),
        ]


def generate_fallback_full_plan(
    request: AICopilotEventGenerationRequest,
) -> AICopilotFullPlanResponse:
    budget_plan = generate_fallback_budget(request.event_type, request.target_budget, request.guest_count)
    timeline_plan = generate_fallback_timeline(request.event_type)
    vendor_checklists = generate_fallback_vendor_checklists(request.event_type)
    inspiration = generate_fallback_inspiration(request.event_type, request.theme)

    return AICopilotFullPlanResponse(
        summary=f"Automated benchmark blueprint for {request.title} ({request.event_type.value}) designed for {request.guest_count} guests with a target budget of ${request.target_budget:,.2f}.",
        theme_recommendation=request.theme or "Timeless & Elegant Celebration",
        budget_breakdown=budget_plan,
        timeline_plan=timeline_plan,
        vendor_checklists=vendor_checklists,
        inspiration_ideas=inspiration,
        source="deterministic_fallback",
    )


def generate_fallback_chat_reply(
    request: AICopilotChatRequest, event_context: dict
) -> AICopilotChatResponse:
    event_data = event_context.get("event", {})
    budget_data = event_context.get("budget", {})
    timeline_data = event_context.get("timeline", {})
    vendors_data = event_context.get("vendors", {})
    guests_data = event_context.get("guests", {})

    warnings: List[CopilotWarning] = []
    proposed_actions: List[CopilotProposedAction] = []
    suggested_prompts: List[str] = [
        "How do I rebalance my budget?",
        "What milestones should I tackle next?",
        "Help me draft vendor negotiation points",
    ]

    is_over = budget_data.get("is_over_budget", False)
    if is_over:
        warnings.append(
            CopilotWarning(
                warning_type="BUDGET_OVERRUN",
                severity="HIGH",
                message="Total committed expenses exceed the target event budget. Rebalance categories or renegotiate quotes.",
            )
        )
        proposed_actions.append(
            CopilotProposedAction(
                action_id=str(uuid.uuid4()),
                action_type=CopilotActionType.ADD_TIMELINE_MILESTONE,
                title="Conduct Emergency Budget Rebalance Review",
                description="Review over-allocated categories and renegotiate non-critical vendor quotes to restore financial margin.",
                parameters={
                    "title": "Emergency Budget Rebalance Review",
                    "phase": "CRITICAL_REVIEW",
                    "priority": "CRITICAL",
                    "description": "Cross-check catering, venue, and decor commitments against target budget.",
                },
                status=CopilotActionStatus.PENDING,
            )
        )

    overdue_count = timeline_data.get("overdue_milestones", 0)
    if overdue_count > 0:
        warnings.append(
            CopilotWarning(
                warning_type="TIMELINE_OVERDUE",
                severity="MEDIUM",
                message=f"{overdue_count} planning milestone(s) are overdue. Focus on unblocking high-priority tasks.",
            )
        )

    msg_lower = request.message.lower()
    if "vendor" in msg_lower or "cater" in msg_lower or "photograph" in msg_lower:
        proposed_actions.append(
            CopilotProposedAction(
                action_id=str(uuid.uuid4()),
                action_type=CopilotActionType.ADD_VENDOR_ITEM,
                title="Add Vendor Inquiry: Royal Feast Caterers",
                description="Initiate quote comparison for multi-cuisine buffet service with live counters.",
                parameters={
                    "category": "Catering",
                    "vendor_name": "Royal Feast Caterers",
                    "status": "RESEARCHING",
                    "quoted_amount": "250000.00",
                    "contact_person": "Chef Anand",
                    "contact_phone": "+91 98111 22233",
                    "notes": "Requested quote for 250 guests including Jain & vegan counters.",
                },
                status=CopilotActionStatus.PENDING,
            )
        )
    elif "budget" in msg_lower or "expense" in msg_lower or "cost" in msg_lower:
        proposed_actions.append(
            CopilotProposedAction(
                action_id=str(uuid.uuid4()),
                action_type=CopilotActionType.ADD_BUDGET_EXPENSE,
                title="Add Budget Expense: Stage & Ambient Lighting",
                description="Allocate estimated cost for event stage lighting and electrical distribution.",
                parameters={
                    "title": "Stage & Ambient Lighting",
                    "category_name": "Decoration",
                    "estimated_cost": "60000.00",
                    "status": "ESTIMATED",
                    "notes": "Low-heat LED warm ambient fixtures and generator backup.",
                },
                status=CopilotActionStatus.PENDING,
            )
        )
    elif "milestone" in msg_lower or "timeline" in msg_lower or "schedule" in msg_lower:
        proposed_actions.append(
            CopilotProposedAction(
                action_id=str(uuid.uuid4()),
                action_type=CopilotActionType.ADD_TIMELINE_MILESTONE,
                title="Add Milestone: Finalize Sound & Lighting Rigging",
                description="Confirm audio-visual equipment schedule and generator backups with production lead.",
                parameters={
                    "title": "Finalize Sound & Lighting Rigging",
                    "phase": "2_WEEKS_BEFORE",
                    "priority": "HIGH",
                    "description": "On-site acoustic test and power distribution safety sign-off.",
                },
                status=CopilotActionStatus.PENDING,
            )
        )
    elif not proposed_actions:
        # Default helpful action proposal
        proposed_actions.append(
            CopilotProposedAction(
                action_id=str(uuid.uuid4()),
                action_type=CopilotActionType.ADD_TIMELINE_MILESTONE,
                title="Review Event Progress & Next Steps",
                description="Evaluate upcoming deadlines and vendor deliverables to keep the planning schedule synchronized.",
                parameters={
                    "title": "Review Event Progress & Next Steps",
                    "phase": "REGULAR_CHECKPOINT",
                    "priority": "MEDIUM",
                    "description": "Generated by AI Copilot during planning session.",
                },
                status=CopilotActionStatus.PENDING,
            )
        )

    title = event_data.get("title", "your event")
    response_text = (
        f"### Planning Insights for **{title}**\n\n"
        f"I've analyzed your current event state and your request: *\"{request.message}\"*.\n\n"
        f"**Observations & Recommendations:**\n"
        f"- **Budget Status**: {'Over budget threshold - immediate review recommended.' if is_over else 'Spending is currently tracked within allocation parameters.'}\n"
        f"- **Timeline Status**: {f'{overdue_count} overdue milestones need attention.' if overdue_count > 0 else 'All scheduled milestones are on track.'}\n"
        f"- **Vendor Pipeline**: {vendors_data.get('booked_vendors', 0)} of {vendors_data.get('total_vendors', 0)} vendors confirmed.\n\n"
        f"I have formulated structured recommendations below. You can approve and apply them directly into your event plan."
    )

    return AICopilotChatResponse(
        response=response_text,
        suggested_prompts=suggested_prompts,
        suggested_actions=[p.title for p in proposed_actions] or ["Review Budget Breakdown", "Check Milestone Due Dates"],
        proposed_actions=proposed_actions,
        warnings=warnings,
        source="deterministic_fallback",
    )

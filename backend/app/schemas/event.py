import re
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from app.models.event import EventType, EventStatus


ISO_4217_REGEX = re.compile(r"^[A-Z]{3}$")


def validate_iso_currency(v: Optional[str]) -> str:
    if v is None:
        return "INR"
    val = str(v).strip().upper()
    if not ISO_4217_REGEX.match(val):
        raise ValueError("Currency must be a valid 3-letter uppercase ISO 4217 code (e.g., INR, USD, EUR).")
    return val


class EventBase(BaseModel):
    title: str = Field(default="", min_length=0, max_length=255, examples=["Sophia & Liam's Wedding"])
    name: Optional[str] = Field(default=None, min_length=2, max_length=255, examples=["Sophia & Liam's Wedding"])
    event_type: EventType = Field(examples=[EventType.WEDDING])
    description: Optional[str] = Field(default=None, max_length=2000)
    location: Optional[str] = Field(default=None, max_length=255, examples=["Mumbai, India"])
    start_date: Optional[datetime] = Field(default=None, examples=["2026-11-20T10:00:00Z"])
    end_date: Optional[datetime] = Field(default=None, examples=["2026-11-20T22:00:00Z"])
    expected_guest_count: int = Field(ge=0, default=0, examples=[150])
    target_budget: Decimal = Field(ge=0, default=Decimal("0.00"), examples=[Decimal("2500000.00")])
    total_budget: Optional[Decimal] = Field(default=None, ge=0, examples=[Decimal("2500000.00")])
    currency: str = Field(default="INR", examples=["INR"])
    status: Optional[EventStatus] = Field(default=EventStatus.PLANNING)
    
    # Backward compatibility
    event_date: Optional[datetime] = Field(default=None)
    theme: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None)

    @field_validator("currency", mode="before")
    @classmethod
    def check_currency(cls, v: Optional[str]) -> str:
        return validate_iso_currency(v)

    @model_validator(mode="after")
    def sync_aliases_and_dates(self) -> "EventBase":
        # Resolve title and name
        if not self.title and self.name:
            self.title = self.name
        elif not self.name and self.title:
            self.name = self.title
        elif not self.title and not self.name:
            raise ValueError("Event title or name must be provided (minimum 2 characters).")

        if len(self.title) < 2:
            raise ValueError("Event title or name must be at least 2 characters.")

        # Resolve target_budget and total_budget
        if self.total_budget is not None and self.target_budget == Decimal("0.00"):
            self.target_budget = self.total_budget
        elif self.total_budget is None:
            self.total_budget = self.target_budget

        # Resolve description and notes
        if self.description and not self.notes:
            self.notes = self.description
        elif self.notes and not self.description:
            self.description = self.notes

        # Resolve start_date and event_date
        if self.start_date and not self.event_date:
            self.event_date = self.start_date
        elif self.event_date and not self.start_date:
            self.start_date = self.event_date

        # Check date chronological order
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")

        return self


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=255)
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    event_type: Optional[EventType] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    location: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    expected_guest_count: Optional[int] = Field(default=None, ge=0)
    target_budget: Optional[Decimal] = Field(default=None, ge=0)
    total_budget: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = None
    status: Optional[EventStatus] = None
    event_date: Optional[datetime] = None
    theme: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("currency", mode="before")
    @classmethod
    def check_currency(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return validate_iso_currency(v)

    @model_validator(mode="after")
    def sync_update_fields(self) -> "EventUpdate":
        if self.name and not self.title:
            self.title = self.name
        elif self.title and not self.name:
            self.name = self.title

        if self.total_budget is not None and self.target_budget is None:
            self.target_budget = self.total_budget
        elif self.target_budget is not None and self.total_budget is None:
            self.total_budget = self.target_budget

        if self.description and not self.notes:
            self.notes = self.description
        elif self.notes and not self.description:
            self.description = self.notes

        if self.start_date and not self.event_date:
            self.event_date = self.start_date
        elif self.event_date and not self.start_date:
            self.start_date = self.event_date

        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")

        return self


class EventResponse(BaseModel):
    id: str
    title: str
    name: str
    event_type: EventType
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    expected_guest_count: int = 0
    target_budget: Decimal
    total_budget: Decimal
    currency: str
    status: EventStatus
    owner_id: Optional[str] = None
    event_date: Optional[datetime] = None
    theme: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventPaginationResponse(BaseModel):
    items: List[EventResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

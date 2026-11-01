from datetime import datetime
from typing import Optional, List, Dict
import re
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from app.models.guest import RSVPStatus, GuestCategory, InvitationStatus

PHONE_REGEX = re.compile(r"^\+?[0-9\s\-\(\)\.]{7,25}$")


class GuestBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    category: str = Field(default=GuestCategory.FRIENDS.value)
    rsvp_status: RSVPStatus = Field(default=RSVPStatus.INVITED)
    invitation_status: InvitationStatus = Field(default=InvitationStatus.NOT_SENT)
    plus_ones: int = Field(default=0, ge=0)
    dietary_preferences: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    accessibility_requirements: Optional[str] = None
    table_assignment: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_email_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not PHONE_REGEX.match(v.strip()):
            raise ValueError("Phone number must contain between 7 and 25 valid phone characters.")
        return v.strip()


class GuestCreate(GuestBase):
    pass


class GuestUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    category: Optional[str] = None
    rsvp_status: Optional[RSVPStatus] = None
    invitation_status: Optional[InvitationStatus] = None
    plus_ones: Optional[int] = Field(default=None, ge=0)
    dietary_preferences: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    accessibility_requirements: Optional[str] = None
    table_assignment: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_email_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not PHONE_REGEX.match(v.strip()):
            raise ValueError("Phone number must contain between 7 and 25 valid phone characters.")
        return v.strip()


class GuestResponse(GuestBase):
    id: str
    event_id: str
    total_party_count: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GuestAnalyticsResponse(BaseModel):
    total_guests: int
    total_invited: int
    confirmed_guests: int
    declined_guests: int
    pending_responses: int
    maybe_responses: int
    expected_attendance: int
    total_plus_ones: int
    confirmed_plus_ones: int
    attendance_rate: float
    dietary_preference_distribution: Dict[str, int]
    guest_category_distribution: Dict[str, int]
    rsvp_status_distribution: Dict[str, int]


class GuestListResponse(BaseModel):
    items: List[GuestResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    analytics: Optional[GuestAnalyticsResponse] = None


class GuestSummaryResponse(BaseModel):
    event_id: str
    total_invitations: int
    total_attending_heads: int
    total_declined_heads: int
    total_pending_heads: int
    dietary_breakdown: Dict[str, int]
    guests: List[GuestResponse]

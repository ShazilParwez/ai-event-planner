from datetime import datetime
from typing import Optional, List
from decimal import Decimal
import re
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from app.models.vendor import VendorStatus

PHONE_REGEX = re.compile(r"^\+?[0-9\s\-\(\)\.]{7,25}$")


class VendorCategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VendorItemBase(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = None
    website: Optional[str] = None
    status: VendorStatus = Field(default=VendorStatus.DISCOVERING)
    estimated_quote: Optional[Decimal] = Field(default=None, ge=0)
    final_agreed_price: Optional[Decimal] = Field(default=None, ge=0)
    advance_paid: Decimal = Field(default=Decimal("0.00"), ge=0)
    contract_signed: bool = False
    notes: Optional[str] = None

    @field_validator("contact_email", mode="before")
    @classmethod
    def empty_email_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not PHONE_REGEX.match(v.strip()):
            raise ValueError("Contact phone number must contain between 7 and 25 valid phone characters.")
        return v.strip()

    @field_validator("advance_paid")
    @classmethod
    def validate_advance_paid(cls, v: Decimal, info) -> Decimal:
        final_agreed = info.data.get("final_agreed_price")
        quote = info.data.get("estimated_quote")
        ceiling = final_agreed if final_agreed is not None else quote
        if ceiling is not None and v > ceiling:
            raise ValueError(f"Advance paid ({v}) cannot exceed agreed/quoted cost ({ceiling}).")
        return v


class VendorItemCreate(VendorItemBase):
    is_ai_suggested_checklist: bool = False


class VendorItemUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    status: Optional[VendorStatus] = None
    estimated_quote: Optional[Decimal] = Field(default=None, ge=0)
    final_agreed_price: Optional[Decimal] = Field(default=None, ge=0)
    advance_paid: Optional[Decimal] = Field(default=None, ge=0)
    contract_signed: Optional[bool] = None
    notes: Optional[str] = None


class VendorItemResponse(VendorItemBase):
    id: str
    event_id: str
    is_ai_suggested_checklist: bool
    quoted_amount: Decimal = Decimal("0.00")
    agreed_cost: Decimal = Decimal("0.00")
    remaining_payment: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VendorSummaryResponse(BaseModel):
    event_id: str
    currency: str = "INR"
    total_vendors: int
    booked_vendors: int
    hired_vendors: int  # Backward-compatible alias for booked_vendors
    pending_vendors: int
    total_quoted_amount: Decimal
    total_agreed_cost: Decimal
    total_advance_paid: Decimal
    total_remaining_payment: Decimal
    total_contracted_spend: Decimal
    items: List[VendorItemResponse]

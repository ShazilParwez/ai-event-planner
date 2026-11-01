from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.models.budget import BudgetItemStatus


class BudgetItemBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    estimated_cost: Decimal = Field(ge=0, default=Decimal("0.00"))
    actual_cost: Decimal = Field(ge=0, default=Decimal("0.00"))
    paid_amount: Decimal = Field(ge=0, default=Decimal("0.00"))
    status: BudgetItemStatus = Field(default=BudgetItemStatus.ESTIMATED)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_payment_consistency(self) -> "BudgetItemBase":
        if self.actual_cost > Decimal("0.00") and self.paid_amount > self.actual_cost:
            raise ValueError("Paid amount cannot exceed actual cost.")
        return self


class BudgetItemCreate(BudgetItemBase):
    category_id: str
    is_ai_suggested: bool = False


class BudgetItemUpdate(BaseModel):
    category_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    estimated_cost: Optional[Decimal] = Field(default=None, ge=0)
    actual_cost: Optional[Decimal] = Field(default=None, ge=0)
    paid_amount: Optional[Decimal] = Field(default=None, ge=0)
    status: Optional[BudgetItemStatus] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_payment_consistency(self) -> "BudgetItemUpdate":
        if (
            self.actual_cost is not None
            and self.paid_amount is not None
            and self.actual_cost > Decimal("0.00")
            and self.paid_amount > self.actual_cost
        ):
            raise ValueError("Paid amount cannot exceed actual cost.")
        return self


class BudgetItemResponse(BudgetItemBase):
    id: str
    category_id: str
    event_id: str
    is_ai_suggested: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BudgetCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    allocated_amount: Decimal = Field(ge=0, default=Decimal("0.00"))
    percentage_target: Decimal = Field(ge=0, le=100, default=Decimal("0.00"))


class BudgetCategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    allocated_amount: Optional[Decimal] = Field(default=None, ge=0)
    percentage_target: Optional[Decimal] = Field(default=None, ge=0, le=100)


class BudgetCategoryResponse(BaseModel):
    id: str
    event_id: str
    name: str
    allocated_amount: Decimal
    percentage_target: Decimal
    items: List[BudgetItemResponse] = []
    total_estimated: Decimal = Decimal("0.00")
    total_actual: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    variance: Decimal = Decimal("0.00")
    utilization_percentage: Decimal = Decimal("0.00")
    is_over_allocated: bool = False

    model_config = ConfigDict(from_attributes=True)


class BudgetOverviewResponse(BaseModel):
    event_id: str
    target_budget: Decimal
    total_allocated: Decimal
    total_estimated: Decimal
    total_actual: Decimal
    total_paid: Decimal
    remaining_budget: Decimal
    variance: Decimal
    is_over_budget: bool
    currency: str = "INR"
    categories: List[BudgetCategoryResponse]


class SeedCategoriesResponse(BaseModel):
    message: str
    created_count: int
    categories: List[BudgetCategoryResponse]

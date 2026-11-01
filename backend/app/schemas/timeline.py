from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.models.timeline import MilestoneStatus, MilestonePriority


class TimelineMilestoneBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    phase: str = Field(default="PLANNING", min_length=1, max_length=100)
    target_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: MilestoneStatus = Field(default=MilestoneStatus.PENDING)
    priority: MilestonePriority = Field(default=MilestonePriority.MEDIUM)
    description: Optional[str] = None
    order_index: int = Field(default=0)

    @field_validator("due_date", mode="before")
    @classmethod
    def sync_due_date(cls, v, info):
        return v

    def model_post_init(self, __context):
        # Synchronize due_date and target_date
        if self.due_date and not self.target_date:
            self.target_date = self.due_date
        elif self.target_date and not self.due_date:
            self.due_date = self.target_date


class TimelineMilestoneCreate(TimelineMilestoneBase):
    is_ai_suggested: bool = False


class TimelineMilestoneUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phase: Optional[str] = None
    target_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: Optional[MilestoneStatus] = None
    priority: Optional[MilestonePriority] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class TimelineActivityBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    start_time: datetime
    end_time: Optional[datetime] = None
    responsible_party: Optional[str] = None
    location: Optional[str] = None
    status: str = Field(default="SCHEDULED")
    order_index: int = Field(default=0)
    description: Optional[str] = None

    @field_validator("end_time")
    @classmethod
    def validate_time_range(cls, v, info):
        start_time = info.data.get("start_time")
        if v is not None and start_time is not None and v < start_time:
            raise ValueError("Activity end_time cannot be earlier than start_time.")
        return v


class TimelineActivityCreate(TimelineActivityBase):
    milestone_id: Optional[str] = None


class TimelineActivityUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    responsible_party: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None
    description: Optional[str] = None
    milestone_id: Optional[str] = None

    @field_validator("end_time")
    @classmethod
    def validate_time_range(cls, v, info):
        start_time = info.data.get("start_time")
        if v is not None and start_time is not None and v < start_time:
            raise ValueError("Activity end_time cannot be earlier than start_time.")
        return v


class TimelineActivityResponse(TimelineActivityBase):
    id: str
    event_id: str
    milestone_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TimelineMilestoneResponse(TimelineMilestoneBase):
    id: str
    event_id: str
    is_ai_suggested: bool
    is_completed: bool = False
    is_overdue: bool = False
    created_at: datetime
    updated_at: datetime
    activities: List[TimelineActivityResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TimelineOverviewResponse(BaseModel):
    event_id: str
    total_milestones: int
    completed_milestones: int
    pending_milestones: int
    overdue_milestones: int
    completion_percentage: float
    milestones: List[TimelineMilestoneResponse]
    activities: List[TimelineActivityResponse] = []

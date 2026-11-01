import json
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


class InspirationCardBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    tags: Optional[str] = None
    color_palette: Optional[List[str]] = None
    suggested_budget_range: Optional[str] = None
    notes: Optional[str] = None
    is_saved: bool = True
    source_type: str = "USER"


class InspirationCardCreate(InspirationCardBase):
    is_ai_generated: bool = False


class InspirationCardUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, min_length=1)
    tags: Optional[str] = None
    color_palette: Optional[List[str]] = None
    suggested_budget_range: Optional[str] = None
    notes: Optional[str] = None
    is_saved: Optional[bool] = None
    source_type: Optional[str] = None


class InspirationCardResponse(InspirationCardBase):
    id: str
    event_id: str
    is_ai_generated: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("color_palette", mode="before")
    @classmethod
    def parse_color_palette(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [c.strip() for c in v.split(",") if c.strip()]
        return v


class InspirationGenerateRequest(BaseModel):
    event_id: str
    category: Optional[str] = Field(default=None, description="Optional focus category")
    custom_prompt: Optional[str] = Field(default=None, description="User prompt or aesthetic notes")
    num_ideas: int = Field(default=4, ge=1, le=10)


class GeneratedIdeaResponse(BaseModel):
    title: str
    category: str
    description: str
    tags: List[str] = []
    color_palette: List[str] = []
    suggested_budget_range: Optional[str] = None
    source_type: str = "AI_GENERATED"


class InspirationGenerateResponse(BaseModel):
    ideas: List[GeneratedIdeaResponse]
    disclaimer: str = "Suggested budget ranges and ideas are creative, indicative estimates—not confirmed vendor quotations."
    source: str = "gemini"

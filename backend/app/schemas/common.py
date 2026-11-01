from typing import Generic, TypeVar, Optional, List, Dict, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[T] = None
    errors: Optional[List[str]] = None


class PaginationMeta(BaseModel):
    page: int = Field(ge=1, default=1)
    page_size: int = Field(ge=1, le=100, default=20)
    total_records: int = 0
    total_pages: int = 0


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    pagination: PaginationMeta


class HealthCheckResponse(BaseModel):
    status: str = "healthy"
    environment: str
    database_connected: bool
    ai_provider_mode: str # "mock" or "gemini"
    ai_circuit_breaker: str # "closed", "open", "half-open"
    version: str = "0.1.0"

import os
from functools import lru_cache
from typing import List
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Event Planner API"
    ENVIRONMENT: str = Field(default="development", description="Runtime environment: development, staging, production")
    LOG_LEVEL: str = Field(default="INFO", description="Logging verbosity level")
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security
    SECRET_KEY: str = Field(
        default="development-insecure-secret-key-32-chars-minimum-replace-in-production",
        description="Application secret key for JWT/session encryption",
    )
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        description="Comma-separated origins for CORS",
    )

    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./event_planner.db",
        description="Database connection string (SQLite for dev, PostgreSQL for production)",
    )
    DB_POOL_SIZE: int = Field(
        default=10,
        description="SQLAlchemy connection pool size for PostgreSQL (QueuePool)",
    )
    DB_MAX_OVERFLOW: int = Field(
        default=20,
        description="Maximum overflow connections allowed beyond DB_POOL_SIZE",
    )
    DB_POOL_RECYCLE: int = Field(
        default=1800,
        description="Connection recycle interval in seconds (default 30 min)",
    )
    DB_POOL_PRE_PING: bool = Field(
        default=True,
        description="Enable connection liveness pre-ping before checkout",
    )
    DB_POOL_TIMEOUT: int = Field(
        default=30,
        description="Timeout in seconds when waiting for an available connection from pool",
    )

    # Google Gemini AI Integration
    USE_MOCK_AI: bool = Field(
        default=True,
        description="If True, returns deterministic mock AI responses without hitting Gemini API",
    )
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key. Never logged or exposed.",
    )
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Target Gemini model name",
    )
    AI_REQUEST_TIMEOUT_SECONDS: int = Field(
        default=15,
        description="Maximum seconds to wait for AI provider response",
    )
    AI_MAX_RETRIES: int = Field(
        default=3,
        description="Maximum bounded retries with exponential backoff on transient AI errors",
    )
    AI_CIRCUIT_BREAKER_FAILURES: int = Field(
        default=5,
        description="Consecutive failures before tripping circuit breaker to deterministic fallback",
    )
    AI_CIRCUIT_BREAKER_RESET_SECONDS: int = Field(
        default=60,
        description="Cool-down period before attempting AI provider recovery",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def is_postgres(self) -> bool:
        return "postgresql" in self.DATABASE_URL

    @field_validator("DATABASE_URL")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("DATABASE_URL must be a non-empty string.")

        normalized = v.strip()
        # Automatically map standard postgresql:// or postgres:// to modern psycopg 3 dialect
        if normalized.startswith("postgres://"):
            normalized = "postgresql+psycopg://" + normalized[len("postgres://"):]
        elif normalized.startswith("postgresql://"):
            normalized = "postgresql+psycopg://" + normalized[len("postgresql://"):]

        # Validate supported schemes
        valid_prefixes = ("sqlite://", "sqlite+pysqlite://", "postgresql+psycopg://")
        if not any(normalized.startswith(prefix) for prefix in valid_prefixes):
            scheme = normalized.split("://")[0] if "://" in normalized else normalized[:15]
            raise ValueError(
                f"Unsupported database scheme in DATABASE_URL: '{scheme}://'. "
                "Supported schemes are 'sqlite://' (development) and 'postgresql+psycopg://' / 'postgresql://' (production with psycopg 3)."
            )

        return normalized

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32 or "development-insecure" in self.SECRET_KEY:
                raise ValueError(
                    "CRITICAL PRODUCTION SECURITY CONFIGURATION ERROR: A cryptographically strong SECRET_KEY "
                    "with minimum 32 characters must be configured in production. Cannot use default or weak key."
                )
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()

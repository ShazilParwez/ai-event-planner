import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.logging import logger
from app.core.database import engine, Base
from app.core.middleware import SecurityHeadersMiddleware, PayloadSizeLimitMiddleware
from app.api.router import api_router
# Ensure all models are registered with Base
import app.models  # noqa: F401

settings = get_settings()


class RequestLoggingMiddleware:
    """Pure ASGI middleware for zero-overhead request logging and timing without BaseHTTPMiddleware deadlocks."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        start_time = time.time()
        path = scope.get("path", "")
        method = scope.get("method", "")
        status_code = 200

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 200)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (time.time() - start_time) * 1000
            logger.info(f"{method} {path} - {status_code} ({duration_ms:.2f}ms)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup lifecycle
    logger.info(f"Starting {settings.PROJECT_NAME} in '{settings.ENVIRONMENT}' environment...")
    logger.info(f"AI Provider mode: {'MOCK' if settings.USE_MOCK_AI else 'GEMINI'}")
    try:
        from app.core.database import SessionLocal
        from app.services.copilot_service import CopilotService
        with SessionLocal() as db:
            CopilotService.recover_stale_actions(db)
    except Exception as e:
        logger.warning(f"Could not run stale action recovery on startup: {e}")
    yield
    # Shutdown lifecycle
    logger.info("Shutting down application cleanly.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-grade GenAI-powered Event Planning Assistant API",
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# 1. Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# 2. Payload Size Limiting (5 MB)
app.add_middleware(PayloadSizeLimitMiddleware)

# 3. CORS Configuration from Environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add pure ASGI request logger
# app.add_middleware(RequestLoggingMiddleware)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
        "health": "/api/v1/healthz",
    }


# ============================================================================
# Global Production Exception Handlers
# ============================================================================

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Catches all database operational and integrity errors.
    Returns safe generic message without exposing internal queries, table names, or credentials.
    """
    logger.error(f"Database error during {request.method} {request.url.path}: {exc.__class__.__name__}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "A database error occurred while processing your request. Please try again later.",
            "message": "Database transaction failure",
            "success": False,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Preserves standard FastAPI validation response format for API compatibility."""
    logger.warning(f"Request validation failure on {request.method} {request.url.path}: {len(exc.errors())} error(s)")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors())},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handles explicit HTTP exceptions preserving headers (such as Retry-After on 429)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def general_unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unexpected backend crashes.
    Prevents stack trace leakage to external callers while logging full diagnostics.
    """
    logger.exception(f"Unhandled server exception during {request.method} {request.url.path}: {exc.__class__.__name__}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please contact support if the issue persists.",
            "message": "Internal server error",
            "success": False,
        },
    )


# Include API routers
app.include_router(api_router)

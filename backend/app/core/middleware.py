from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()

MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB maximum request payload


class SecurityHeadersMiddleware:
    """Pure ASGI middleware that injects recommended defense-in-depth security headers."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                
                # Security Headers
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"x-frame-options", b"DENY"))
                headers.append((b"x-xss-protection", b"1; mode=block"))
                headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                
                if settings.ENVIRONMENT == "production":
                    headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


class PayloadSizeLimitMiddleware:
    """Pure ASGI middleware enforcing maximum HTTP request body size to guard against buffer exhaustion attacks."""

    def __init__(self, app, max_bytes: int = MAX_CONTENT_LENGTH):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            content_length = headers.get(b"content-length")
            if content_length:
                try:
                    if int(content_length) > self.max_bytes:
                        response = JSONResponse(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            content={
                                "success": False,
                                "message": f"Payload exceeds the maximum allowed size of {self.max_bytes // (1024 * 1024)} MB.",
                                "data": None,
                            },
                        )
                        return await response(scope, receive, send)
                except ValueError:
                    pass

        await self.app(scope, receive, send)


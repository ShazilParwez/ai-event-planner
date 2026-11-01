import time
import threading
from typing import Dict, List, Optional, Tuple
from fastapi import Request, HTTPException, status
from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter with per-user and per-IP accounting."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # Storage: key -> list of float epoch timestamps
        self._windows: Dict[str, List[float]] = {}

    def _cleanup_old_timestamps(self, key: str, cutoff: float) -> None:
        if key in self._windows:
            self._windows[key] = [ts for ts in self._windows[key] if ts > cutoff]
            if not self._windows[key]:
                del self._windows[key]

    def check_rate_limit(
        self,
        identifier: str,
        limit: int,
        window_seconds: int = 60,
    ) -> Tuple[bool, int, int]:
        """
        Checks if the identifier has exceeded the request limit within the sliding window.
        Returns:
            allowed (bool): True if allowed, False if exceeded
            current_count (int): Number of requests recorded in current window
            retry_after (int): Seconds until the oldest request expires from the window
        """
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            self._cleanup_old_timestamps(identifier, cutoff)
            history = self._windows.setdefault(identifier, [])

            if len(history) >= limit:
                oldest = history[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                return False, len(history), retry_after

            history.append(now)
            return True, len(history), 0

    def reset(self) -> None:
        """Clears all rate limit windows (useful for testing)."""
        with self._lock:
            self._windows.clear()


# Global singleton instance
rate_limiter = SlidingWindowRateLimiter()


class RateLimitDependency:
    """FastAPI Dependency for enforcing rate limits on expensive operations."""

    def __init__(
        self,
        limit: int = 15,
        window_seconds: int = 60,
        scope: str = "ai_generation",
    ) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.scope = scope

    async def __call__(self, request: Request) -> None:
        # Determine client identity (authenticated user ID if present on request.state, otherwise client IP)
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()
            elif request.client:
                client_ip = request.client.host
            else:
                client_ip = "127.0.0.1"
            identifier = f"{self.scope}:ip:{client_ip}"
        else:
            identifier = f"{self.scope}:user:{user_id}"

        allowed, count, retry_after = rate_limiter.check_rate_limit(
            identifier=identifier,
            limit=self.limit,
            window_seconds=self.window_seconds,
        )

        if not allowed:
            logger.warning(
                f"Rate limit exceeded for '{identifier}' on '{request.url.path}'. "
                f"({count}/{self.limit} reqs in {self.window_seconds}s). Retry after: {retry_after}s"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {self.limit} requests per minute allowed for this operation.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + retry_after)),
                },
            )


# Default pre-configured dependencies
copilot_rate_limiter = RateLimitDependency(limit=10, window_seconds=60, scope="copilot_chat")
ai_plan_rate_limiter = RateLimitDependency(limit=5, window_seconds=60, scope="ai_event_plan")

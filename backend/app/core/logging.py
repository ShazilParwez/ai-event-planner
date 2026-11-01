import logging
import re
import sys
from typing import Any
from app.core.config import get_settings

# Regex patterns and replacements to sanitize sensitive credentials, keys, database passwords, and hashes
SECRET_PATTERNS = [
    # Google API keys
    (re.compile(r'(AIza[0-9A-Za-z-_]{20,})', re.IGNORECASE), r'***API_KEY_REDACTED***'),
    # Bearer tokens
    (re.compile(r'(Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*)', re.IGNORECASE), r'Bearer ***TOKEN_REDACTED***'),
    # Raw JWTs
    (re.compile(r'(eyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]+)', re.IGNORECASE), r'***JWT_REDACTED***'),
    # Database connection URLs with user passwords: scheme://user:password@host
    (re.compile(r'((?:postgresql|postgres|mysql|sqlite)(?:\+[a-z0-9]+)?:\/\/[^:]+:)([^@]+)(@)', re.IGNORECASE), r'\1***REDACTED***\3'),
    # Password, secret, and token assignments in key-value format
    (re.compile(r'("?(?:password|current_password|new_password|secret|api_key|token|auth)"?\s*[:=]\s*"?)([^",\s]+)("?)', re.IGNORECASE), r'\1***REDACTED***\3'),
    # Argon2 and bcrypt password hashes
    (re.compile(r'(\$argon2(?:id|i|d)?\$[^\s"\']+)', re.IGNORECASE), r'***HASH_REDACTED***'),
    (re.compile(r'(\$2[aby]?\$[0-9]{2}\$[^\s"\']+)', re.IGNORECASE), r'***HASH_REDACTED***'),
]


class RedactingFormatter(logging.Formatter):
    """Custom formatter that scrubs sensitive credentials, database passwords, and tokens from logs."""

    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        redacted = original
        for pattern, replacement in SECRET_PATTERNS:
            redacted = pattern.sub(replacement, redacted)
        return redacted


def setup_logging() -> logging.Logger:
    settings = get_settings()
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    logger = logging.getLogger("ai_event_planner")
    logger.setLevel(log_level)

    # Avoid duplicate handlers if re-initialized
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(log_level)
        formatter = RedactingFormatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()

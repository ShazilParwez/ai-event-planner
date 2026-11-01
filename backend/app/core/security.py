import os
import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
import jwt
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from cryptography.exceptions import InvalidKey

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Dummy hash for constant-time comparison against nonexistent users (timing attack mitigation)
DUMMY_ARGON2_HASH = "$argon2id$v=19$m=65536,t=2,p=4$dGVzdHNhbHRmb3JkdW1teQ==$rqa+ARJjeTEYAToqKgB8igaA7wT8oA8Xz54xI2i8u3k="

# Argon2id parameters (conforming to RFC 9106 recommended minimums for sensitive auth)
ARGON2_SALT_BYTES = 16
ARGON2_KEY_LENGTH = 32
ARGON2_ITERATIONS = 2
ARGON2_LANES = 4
ARGON2_MEMORY_COST_KB = 65536  # 64 MB memory hardness


def get_password_hash(password: str) -> str:
    """Hashes a plaintext password using Argon2id with cryptographically secure salt."""
    salt = os.urandom(ARGON2_SALT_BYTES)
    kdf = Argon2id(
        salt=salt,
        length=ARGON2_KEY_LENGTH,
        iterations=ARGON2_ITERATIONS,
        lanes=ARGON2_LANES,
        memory_cost=ARGON2_MEMORY_COST_KB,
        ad=None,
        secret=None,
    )
    derived_key = kdf.derive(password.encode("utf-8"))
    
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived_key).decode("ascii")
    
    # Store standard Modular Crypt Format-like representation
    return f"$argon2id$v=19$m={ARGON2_MEMORY_COST_KB},t={ARGON2_ITERATIONS},p={ARGON2_LANES}${salt_b64}${hash_b64}"


hash_password = get_password_hash


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against an Argon2id formatted hash."""
    if not hashed_password or not hashed_password.startswith("$argon2id$"):
        return False
    
    try:
        parts = hashed_password.split("$")
        # Format: ['', 'argon2id', 'v=19', 'm=65536,t=2,p=4', salt_b64, hash_b64]
        if len(parts) < 6:
            return False
            
        params_str = parts[3]
        salt_b64 = parts[4]
        hash_b64 = parts[5]
        
        # Parse params
        params: Dict[str, int] = {}
        for p in params_str.split(","):
            k, v = p.split("=")
            params[k] = int(v)
            
        memory_cost = params.get("m", ARGON2_MEMORY_COST_KB)
        iterations = params.get("t", ARGON2_ITERATIONS)
        lanes = params.get("p", ARGON2_LANES)
        
        salt = base64.b64decode(salt_b64)
        expected_key = base64.b64decode(hash_b64)
        
        kdf = Argon2id(
            salt=salt,
            length=len(expected_key),
            iterations=iterations,
            lanes=lanes,
            memory_cost=memory_cost,
            ad=None,
            secret=None,
        )
        kdf.verify(plain_password.encode("utf-8"), expected_key)
        return True
    except (InvalidKey, Exception) as exc:
        logger.debug(f"Password verification failed: {exc}")
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
    token_version: Optional[int] = None,
) -> str:
    """Generates a signed JWT access token with expiry timestamp, subject, and session token_version."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access",
        "token_version": token_version if token_version is not None else data.get("token_version", 1),
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(
    data: Dict[str, Any],
    jti: Optional[str] = None,
    token_version: Optional[int] = None,
) -> Tuple[str, str, datetime]:
    """Generates a long-lived JWT refresh token with unique jti identifier and session token_version."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    token_jti = jti or str(uuid.uuid4())
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "jti": token_jti,
        "token_version": token_version if token_version is not None else data.get("token_version", 1),
    })
    token_str = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return token_str, token_jti, expire


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token signature and expiration."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT token has expired.")
        return None
    except jwt.InvalidTokenError as exc:
        logger.debug(f"Invalid JWT token: {exc}")
        return None

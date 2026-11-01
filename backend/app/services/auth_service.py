from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import UserCreate, UserLogin, PasswordChangeRequest
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    DUMMY_ARGON2_HASH,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.core.logging import logger


class AuthService:
    """Manages user registration, credential authentication, JWT lifecycle, and refresh token rotation."""

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        normalized = email.strip().lower()
        return db.query(User).filter(User.email == normalized).first()

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @classmethod
    def register_user(cls, db: Session, user_in: UserCreate) -> Tuple[User, str, str]:
        normalized_email = user_in.email.strip().lower()
        existing = cls.get_by_email(db, normalized_email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists.",
            )

        hashed = get_password_hash(user_in.password)
        user = User(
            email=normalized_email,
            hashed_password=hashed,
            full_name=user_in.full_name,
            is_active=True,
            is_superuser=False,
            token_version=1,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(f"User registered successfully: {user.id}")
        token_data = {"sub": user.id, "email": user.email, "token_version": user.token_version}
        access_token = create_access_token(token_data, token_version=user.token_version)
        refresh_token_str, jti, expire = create_refresh_token(token_data, token_version=user.token_version)

        # Store refresh token record for rotation and reuse tracking
        db_token = RefreshToken(
            token_jti=jti,
            user_id=user.id,
            expires_at=expire,
            revoked=False,
        )
        db.add(db_token)
        db.commit()

        return user, access_token, refresh_token_str

    @classmethod
    def authenticate_user(cls, db: Session, email: str, password: str) -> Optional[User]:
        user = cls.get_by_email(db, email)
        if not user:
            # Timing attack mitigation: compute Argon2id on dummy hash to preserve constant execution time
            verify_password(password, DUMMY_ARGON2_HASH)
            return None

        # Constant-time password check
        is_valid = verify_password(password, user.hashed_password)
        if not is_valid:
            return None

        # Exclude inactive users without leaking account status
        if not user.is_active:
            logger.warning(f"Authentication rejected for inactive user account: {user.id}")
            return None

        return user

    @classmethod
    def login_user(cls, db: Session, login_in: UserLogin) -> Tuple[User, str, str]:
        user = cls.authenticate_user(db, login_in.email, login_in.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token_data = {"sub": user.id, "email": user.email, "token_version": user.token_version}
        access_token = create_access_token(token_data, token_version=user.token_version)
        refresh_token_str, jti, expire = create_refresh_token(token_data, token_version=user.token_version)

        # Store refresh token record
        db_token = RefreshToken(
            token_jti=jti,
            user_id=user.id,
            expires_at=expire,
            revoked=False,
        )
        db.add(db_token)
        db.commit()

        logger.info(f"User logged in successfully: {user.id}")
        return user, access_token, refresh_token_str

    @classmethod
    def refresh_access_token(cls, db: Session, refresh_token_str: str) -> Tuple[User, str, str]:
        """
        Exchanges a valid refresh token for a new access token and rotated refresh token.
        Detects token reuse: if a previously revoked refresh token is presented, all sessions
        for the user are terminated immediately as an active security defense.
        """
        payload = decode_token(refresh_token_str)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = payload.get("sub")
        jti = payload.get("jti")
        token_version = payload.get("token_version", 1)

        if not user_id or not jti:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed refresh token claims.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = cls.get_by_id(db, user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account inactive or no longer exists.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Invalidate if user's global session token version has been bumped (e.g. password change)
        if token_version != user.token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been invalidated. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Query token registry for this jti
        db_token = db.query(RefreshToken).filter(RefreshToken.token_jti == jti).first()
        if not db_token:
            # Token not found in registry
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unrecognized refresh token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # REUSE DETECTION: If this token was already revoked, someone is replaying an old token
        if db_token.revoked:
            logger.warning(
                f"SECURITY ALERT: Refresh token reuse detected for user {user.id} (jti: {jti}). "
                "Revoking all active sessions immediately."
            )
            # Invalidate all active tokens for this user
            user.token_version += 1
            db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": True})
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token reuse detected. All sessions have been terminated for security.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Rotate token: revoke current token
        db_token.revoked = True

        # Generate new access token and rotated refresh token
        token_data = {"sub": user.id, "email": user.email, "token_version": user.token_version}
        new_access_token = create_access_token(token_data, token_version=user.token_version)
        new_refresh_str, new_jti, new_expire = create_refresh_token(token_data, token_version=user.token_version)

        db_token.replaced_by = new_jti

        # Register new refresh token
        new_db_token = RefreshToken(
            token_jti=new_jti,
            user_id=user.id,
            expires_at=new_expire,
            revoked=False,
        )
        db.add(new_db_token)
        db.commit()

        return user, new_access_token, new_refresh_str

    @classmethod
    def logout_user(cls, db: Session, refresh_token_str: str, all_devices: bool = False) -> None:
        """Revokes refresh token on logout, optionally terminating all device sessions."""
        payload = decode_token(refresh_token_str)
        if not payload or payload.get("type") != "refresh":
            # Silently exit or return cleanly on already expired/malformed token to prevent leakage
            return

        user_id = payload.get("sub")
        jti = payload.get("jti")

        if all_devices and user_id:
            user = cls.get_by_id(db, user_id)
            if user:
                user.token_version += 1
                db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": True})
                db.commit()
                logger.info(f"User {user.id} logged out from all devices.")
                return

        if jti:
            db.query(RefreshToken).filter(RefreshToken.token_jti == jti).update({"revoked": True})
            db.commit()
            logger.info(f"Revoked refresh token {jti} on logout.")

    @classmethod
    def change_password(
        cls, db: Session, user: User, change_in: PasswordChangeRequest
    ) -> Tuple[User, str, str]:
        """
        Securely changes user password, invalidating all existing access and refresh tokens
        by incrementing token_version and revoking all stored refresh tokens.
        """
        if not verify_password(change_in.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )

        if change_in.current_password == change_in.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be identical to the current password.",
            )

        # Hash new password
        user.hashed_password = get_password_hash(change_in.new_password)

        # Invalidate all existing sessions
        user.token_version += 1
        db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": True})

        # Issue fresh token pair for current session
        token_data = {"sub": user.id, "email": user.email, "token_version": user.token_version}
        new_access = create_access_token(token_data, token_version=user.token_version)
        new_refresh_str, new_jti, new_expire = create_refresh_token(token_data, token_version=user.token_version)

        new_db_token = RefreshToken(
            token_jti=new_jti,
            user_id=user.id,
            expires_at=new_expire,
            revoked=False,
        )
        db.add(new_db_token)
        db.commit()
        db.refresh(user)

        logger.info(f"Password changed and all previous sessions invalidated for user {user.id}.")
        return user, new_access, new_refresh_str


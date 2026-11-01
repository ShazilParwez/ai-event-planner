from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class RefreshToken(Base, UUIDMixin, TimestampMixin):
    """
    Stores issued refresh tokens for rotation tracking, revocation, and reuse detection.
    Conforms to RFC 6749 and OAuth 2.0 Threat Model (RFC 6819) guidelines.
    """
    __tablename__ = "refresh_tokens"

    token_jti = Column(String(36), unique=True, index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    replaced_by = Column(String(36), nullable=True)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")


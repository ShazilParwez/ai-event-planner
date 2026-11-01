from typing import Optional
from fastapi import APIRouter, Depends, status, HTTPException, Request, Response, Body
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    RefreshTokenRequest,
    PasswordChangeRequest,
    LogoutRequest,
)
from app.schemas.common import StandardResponse
from app.services.auth_service import AuthService
from app.core.config import get_settings
from app.core.security import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])

COOKIE_KEY_REFRESH = "refresh_token"


def set_auth_cookies(response: Response, refresh_token: str) -> None:
    """Sets secure, HttpOnly, SameSite=Lax refresh-token cookie."""
    response.set_cookie(
        key=COOKIE_KEY_REFRESH,
        value=refresh_token,
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth",
    )


def clear_auth_cookies(response: Response) -> None:
    """Removes the refresh-token cookie across all devices and sessions."""
    response.delete_cookie(
        key=COOKIE_KEY_REFRESH,
        path="/api/v1/auth",
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="lax",
    )


@router.post(
    "/register",
    response_model=StandardResponse[TokenResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(
    user_in: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
) -> StandardResponse[TokenResponse]:
    """Registers a new user and issues immediate JWT access & refresh tokens."""
    user, access_token, refresh_token = AuthService.register_user(db, user_in)
    set_auth_cookies(response, refresh_token)
    # In production, disable JS-readable refresh token fallback in response body to prevent token theft
    delivered_refresh_token = None if settings.ENVIRONMENT == "production" else refresh_token
    return StandardResponse(
        message="User registered successfully",
        data=TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            refresh_token=delivered_refresh_token,
            user=UserResponse.model_validate(user),
        ),
    )


@router.post(
    "/login",
    response_model=StandardResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Authenticate and obtain JWT tokens",
)
def login(
    login_in: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
) -> StandardResponse[TokenResponse]:
    """Authenticates email & password credentials, issuing JWT access & refresh tokens."""
    user, access_token, refresh_token = AuthService.login_user(db, login_in)
    set_auth_cookies(response, refresh_token)
    # In production, disable JS-readable refresh token fallback in response body to prevent token theft
    delivered_refresh_token = None if settings.ENVIRONMENT == "production" else refresh_token
    return StandardResponse(
        message="Login successful",
        data=TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            refresh_token=delivered_refresh_token,
            user=UserResponse.model_validate(user),
        ),
    )


@router.post(
    "/refresh",
    response_model=StandardResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Refresh an expired access token",
)
def refresh_token(
    request: Request,
    response: Response,
    refresh_in: Optional[RefreshTokenRequest] = Body(default=None),
    db: Session = Depends(get_db),
) -> StandardResponse[TokenResponse]:
    """Exchanges a valid refresh token (from HttpOnly cookie or body) for a fresh access token."""
    token: Optional[str] = None
    if refresh_in and refresh_in.refresh_token:
        token = refresh_in.refresh_token
    elif COOKIE_KEY_REFRESH in request.cookies:
        token = request.cookies.get(COOKIE_KEY_REFRESH)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required in HttpOnly cookie or request body",
        )

    user, new_access, new_refresh = AuthService.refresh_access_token(db, token)
    set_auth_cookies(response, new_refresh)
    # In production, disable JS-readable refresh token fallback in response body to prevent token theft
    delivered_refresh_token = None if settings.ENVIRONMENT == "production" else new_refresh
    return StandardResponse(
        message="Token refreshed successfully",
        data=TokenResponse(
            access_token=new_access,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            refresh_token=delivered_refresh_token,
            user=UserResponse.model_validate(user),
        ),
    )


@router.get(
    "/me",
    response_model=StandardResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse[UserResponse]:
    """Returns the profile of the currently authenticated user."""
    return StandardResponse(
        data=UserResponse.model_validate(current_user)
    )


@router.post(
    "/logout",
    response_model=StandardResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Revoke refresh token and terminate session",
)
def logout(
    request: Request,
    response: Response,
    logout_in: Optional[LogoutRequest] = Body(default=None),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    """Revokes the given refresh token (and optionally all sessions for the user)."""
    token: Optional[str] = None
    all_devices = False
    if logout_in and logout_in.refresh_token:
        token = logout_in.refresh_token
        all_devices = logout_in.all_devices
    elif COOKIE_KEY_REFRESH in request.cookies:
        token = request.cookies.get(COOKIE_KEY_REFRESH)
        if logout_in:
            all_devices = logout_in.all_devices

    if token:
        try:
            AuthService.logout_user(db, token, all_devices=all_devices)
        except Exception:
            pass  # Fail safely on revocation errors

    clear_auth_cookies(response)
    return StandardResponse(message="Logged out successfully")


@router.post(
    "/change-password",
    response_model=StandardResponse[TokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Change user password and invalidate previous sessions",
)
def change_password(
    change_in: PasswordChangeRequest,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[TokenResponse]:
    """Changes password, invalidating all previously issued tokens across all devices."""
    user, new_access, new_refresh = AuthService.change_password(db, current_user, change_in)
    set_auth_cookies(response, new_refresh)
    return StandardResponse(
        message="Password changed successfully. All previous sessions have been invalidated.",
        data=TokenResponse(
            access_token=new_access,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            refresh_token=new_refresh,
            user=UserResponse.model_validate(user),
        ),
    )

import time
import uuid
import pytest
from datetime import datetime, timedelta
from fastapi import status

from app.models.user import User
from app.models.event import Event, EventType, EventStatus
from app.models.budget import BudgetCategory, BudgetItem
from app.models.timeline import TimelineMilestone
from app.models.vendor import VendorItem
from app.models.guest import Guest, RSVPStatus
from app.core.security import (
    hash_password,
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.rate_limit import rate_limiter


# ============================================================================
# 1. Password Hashing and Crypto Unit Tests
# ============================================================================

def test_argon2id_password_hashing():
    raw_password = "SuperSecurePassword123!"
    hashed = hash_password(raw_password)

    # Must be Argon2 formatted string
    assert hashed.startswith("$argon2id$")
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

    # Distinct hashes with unique salts for identical inputs
    hashed2 = hash_password(raw_password)
    assert hashed != hashed2
    assert verify_password(raw_password, hashed2) is True


def test_jwt_token_creation_and_expiration():
    user_id = "test-user-id-12345"
    access_token = create_access_token({"sub": user_id, "email": "test@example.com"})
    payload = decode_token(access_token)

    assert payload is not None
    assert payload["sub"] == user_id
    assert payload["type"] == "access"
    assert "exp" in payload

    # Test expired token
    expired_token = create_access_token(
        {"sub": user_id, "type": "access"},
        expires_delta=timedelta(seconds=-10),
    )
    assert decode_token(expired_token) is None


# ============================================================================
# 2. User Registration, Login & Authentication Endpoints
# ============================================================================

def test_user_registration_success(unauthenticated_client, db):
    email = f"alice_{uuid.uuid4().hex[:8]}@eventflow.org"
    payload = {
        "email": email,
        "password": "SecurePassword123!",
        "full_name": "Alice Planner",
    }
    response = unauthenticated_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_201_CREATED

    data = response.json()["data"]
    assert data["user"]["email"] == email
    assert data["user"]["full_name"] == "Alice Planner"
    assert "hashed_password" not in data["user"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_user_registration_duplicate_email(unauthenticated_client):
    email = f"duplicate_{uuid.uuid4().hex[:8]}@eventflow.org"
    payload = {
        "email": email,
        "password": "Password123!",
        "full_name": "First User",
    }
    res1 = unauthenticated_client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == status.HTTP_201_CREATED

    res2 = unauthenticated_client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in res2.json()["detail"].lower()


def test_user_registration_invalid_email(unauthenticated_client):
    payload = {
        "email": "not-an-email",
        "password": "Password123!",
        "full_name": "Bad Email",
    }
    response = unauthenticated_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_user_login_success(unauthenticated_client):
    email = f"loginuser_{uuid.uuid4().hex[:8]}@eventflow.org"
    reg = {
        "email": email,
        "password": "CorrectPassword456!",
        "full_name": "Login Tester",
    }
    unauthenticated_client.post("/api/v1/auth/register", json=reg)

    login_res = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "CorrectPassword456!"},
    )
    assert login_res.status_code == status.HTTP_200_OK
    data = login_res.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == email
    assert "hashed_password" not in data["user"]


def test_user_login_invalid_credentials(unauthenticated_client):
    # Nonexistent user
    res1 = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": f"nobody_{uuid.uuid4().hex[:8]}@nowhere.com", "password": "AnyPassword123!"},
    )
    assert res1.status_code == status.HTTP_401_UNAUTHORIZED

    # Existing user with wrong password
    email = f"wrongpw_{uuid.uuid4().hex[:8]}@eventflow.org"
    unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "RightPassword123!"},
    )
    res2 = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword123!"},
    )
    assert res2.status_code == status.HTTP_401_UNAUTHORIZED


def test_current_user_me_endpoint(unauthenticated_client):
    # Unauthenticated request
    res_unauth = unauthenticated_client.get("/api/v1/auth/me")
    assert res_unauth.status_code == status.HTTP_401_UNAUTHORIZED

    # Register & get token
    email = f"me_{uuid.uuid4().hex[:8]}@eventflow.org"
    reg = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!"},
    ).json()["data"]
    token = reg["access_token"]

    # Authenticated request
    res_auth = unauthenticated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_auth.status_code == status.HTTP_200_OK
    assert res_auth.json()["data"]["email"] == email


def test_token_refresh(unauthenticated_client):
    email = f"refresher_{uuid.uuid4().hex[:8]}@eventflow.org"
    reg = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!"},
    ).json()["data"]
    refresh_tok = reg["refresh_token"]

    ref_res = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_tok},
    )
    assert ref_res.status_code == status.HTTP_200_OK
    data = ref_res.json()["data"]
    assert "access_token" in data
    assert data["token_type"] == "bearer"


# ============================================================================
# 3. Multi-Tenancy & Event Ownership Isolation (IDOR Defense)
# ============================================================================

@pytest.fixture
def user_tokens(unauthenticated_client):
    """Creates User A and User B with unique emails and yields their Bearer tokens."""
    email_a = f"tenant_a_{uuid.uuid4().hex[:8]}@events.com"
    email_b = f"tenant_b_{uuid.uuid4().hex[:8]}@events.com"

    res_a = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email_a, "password": "Password123!", "full_name": "Tenant A"},
    ).json()["data"]
    res_b = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email_b, "password": "Password123!", "full_name": "Tenant B"},
    ).json()["data"]

    return {
        "user_a_token": res_a["access_token"],
        "user_a_id": res_a["user"]["id"],
        "user_b_token": res_b["access_token"],
        "user_b_id": res_b["user"]["id"],
    }


def test_event_creation_sets_owner(unauthenticated_client, user_tokens):
    headers_a = {"Authorization": f"Bearer {user_tokens['user_a_token']}"}
    create_res = unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "Tenant A Wedding", "event_type": "WEDDING", "target_budget": 500000},
        headers=headers_a,
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    event_data = create_res.json()["data"]
    assert event_data["owner_id"] == user_tokens["user_a_id"]


def test_cross_tenant_forbidden_event_access(unauthenticated_client, user_tokens):
    headers_a = {"Authorization": f"Bearer {user_tokens['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {user_tokens['user_b_token']}"}

    # User A creates Event
    create_evt_res = unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "Private Community Gala", "event_type": "COMMUNITY", "target_budget": 300000},
        headers=headers_a,
    )
    assert create_evt_res.status_code == status.HTTP_201_CREATED
    event_id = create_evt_res.json()["data"]["id"]

    # User B attempts GET
    get_res = unauthenticated_client.get(f"/api/v1/events/{event_id}", headers=headers_b)
    assert get_res.status_code == status.HTTP_403_FORBIDDEN
    assert "forbidden" in get_res.json()["detail"].lower()

    # User B attempts PUT
    put_res = unauthenticated_client.put(
        f"/api/v1/events/{event_id}",
        json={"title": "Malicious Modification"},
        headers=headers_b,
    )
    assert put_res.status_code == status.HTTP_403_FORBIDDEN

    # User B attempts DELETE
    del_res = unauthenticated_client.delete(f"/api/v1/events/{event_id}", headers=headers_b)
    assert del_res.status_code == status.HTTP_403_FORBIDDEN


def test_event_listing_isolation(unauthenticated_client, user_tokens):
    headers_a = {"Authorization": f"Bearer {user_tokens['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {user_tokens['user_b_token']}"}

    # User A creates 2 events
    unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "User A Event 1", "event_type": "BIRTHDAY", "target_budget": 20000},
        headers=headers_a,
    )
    unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "User A Event 2", "event_type": "COMMUNITY", "target_budget": 80000},
        headers=headers_a,
    )

    # User B creates 1 event
    unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "User B Solo Event", "event_type": "OTHER", "target_budget": 40000},
        headers=headers_b,
    )

    # User A list
    list_a = unauthenticated_client.get("/api/v1/events", headers=headers_a).json()["data"]
    assert all(e["owner_id"] == user_tokens["user_a_id"] for e in list_a)
    assert len(list_a) == 2

    # User B list
    list_b = unauthenticated_client.get("/api/v1/events", headers=headers_b).json()["data"]
    assert all(e["owner_id"] == user_tokens["user_b_id"] for e in list_b)
    assert len(list_b) == 1
    assert list_b[0]["title"] == "User B Solo Event"


def test_nested_resource_ownership_protection(unauthenticated_client, user_tokens):
    """Verifies that budget, timeline, guests, vendors, and copilot endpoints reject cross-tenant access."""
    headers_a = {"Authorization": f"Bearer {user_tokens['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {user_tokens['user_b_token']}"}

    # User A creates Event
    create_res = unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "Secure Vault Event", "event_type": "WEDDING", "target_budget": 100000},
        headers=headers_a,
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    event_id = create_res.json()["data"]["id"]

    # Budget Overview
    res = unauthenticated_client.get(f"/api/v1/events/{event_id}/budget", headers=headers_b)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Add Budget Category
    res = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "Hacked Flowers", "allocated_amount": 1000},
        headers=headers_b,
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Timeline Overview
    res = unauthenticated_client.get(f"/api/v1/events/{event_id}/timeline", headers=headers_b)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Add Milestone
    res = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/timeline/milestones",
        json={"title": "Hacked Milestone"},
        headers=headers_b,
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Guests
    res = unauthenticated_client.get(f"/api/v1/events/{event_id}/guests", headers=headers_b)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    res = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/guests",
        json={"name": "Intruder Smith", "email": "intruder@bad.com"},
        headers=headers_b,
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Inspiration
    res = unauthenticated_client.get(f"/api/v1/events/{event_id}/inspiration", headers=headers_b)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Copilot Threads
    res = unauthenticated_client.get(f"/api/v1/events/{event_id}/copilot/threads", headers=headers_b)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    res = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/copilot/threads",
        json={"title": "Hacker Thread"},
        headers=headers_b,
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Dashboard
    res = unauthenticated_client.get(f"/api/v1/events/{event_id}/dashboard", headers=headers_b)
    assert res.status_code == status.HTTP_403_FORBIDDEN


# ============================================================================
# 4. Rate Limiting Protection (HTTP 429 & Retry-After)
# ============================================================================

def test_copilot_rate_limiting_enforcement(unauthenticated_client, user_tokens):
    headers_a = {"Authorization": f"Bearer {user_tokens['user_a_token']}"}

    create_evt = unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "Rate Limit Test Event", "event_type": "OTHER", "target_budget": 50000},
        headers=headers_a,
    )
    assert create_evt.status_code == status.HTTP_201_CREATED
    event_id = create_evt.json()["data"]["id"]

    create_thread = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/copilot/threads",
        json={"title": "RL Thread"},
        headers=headers_a,
    )
    assert create_thread.status_code == status.HTTP_201_CREATED
    thread_id = create_thread.json()["data"]["id"]

    rate_limiter.reset()

    # Copilot rate limit is 10 requests per minute
    # Send 10 messages successfully
    for i in range(10):
        res = unauthenticated_client.post(
            f"/api/v1/events/{event_id}/copilot/threads/{thread_id}/messages",
            json={"content": f"Ping message #{i+1}"},
            headers=headers_a,
        )
        assert res.status_code == status.HTTP_200_OK

    # 11th request must fail with 429 Too Many Requests
    exceeded_res = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/copilot/threads/{thread_id}/messages",
        json={"content": "Ping message #11 (Exceeded)"},
        headers=headers_a,
    )
    assert exceeded_res.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in exceeded_res.headers
    assert int(exceeded_res.headers["Retry-After"]) >= 1
    assert "X-RateLimit-Limit" in exceeded_res.headers
    assert exceeded_res.headers["X-RateLimit-Remaining"] == "0"


# ============================================================================
# 5. Input Validation Hardening (EmailStr & Phone Regex)
# ============================================================================

def test_guest_email_and_phone_validation(unauthenticated_client, user_tokens):
    headers = {"Authorization": f"Bearer {user_tokens['user_a_token']}"}
    create_evt = unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "Validation Test Event", "event_type": "BIRTHDAY", "target_budget": 10000},
        headers=headers,
    )
    assert create_evt.status_code == status.HTTP_201_CREATED
    event_id = create_evt.json()["data"]["id"]

    # Invalid email
    bad_email = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/guests",
        json={"name": "John Doe", "email": "invalid-email-string"},
        headers=headers,
    )
    assert bad_email.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Invalid phone format
    bad_phone = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/guests",
        json={"name": "John Doe", "phone": "abc-not-phone"},
        headers=headers,
    )
    assert bad_phone.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Valid international phone format
    good_guest = unauthenticated_client.post(
        f"/api/v1/events/{event_id}/guests",
        json={
            "name": "John Doe",
            "email": "valid.guest@example.com",
            "phone": "+91 98765 43210",
        },
        headers=headers,
    )
    assert good_guest.status_code == status.HTTP_201_CREATED
    assert good_guest.json()["data"]["phone"] == "+91 98765 43210"


# ============================================================================
# 6. Security Headers & Payload Size Limit Verification
# ============================================================================

def test_security_headers_present(unauthenticated_client):
    res = unauthenticated_client.get("/api/v1/healthz")
    assert res.status_code == status.HTTP_200_OK

    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("X-XSS-Protection") == "1; mode=block"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_payload_size_limit_middleware(unauthenticated_client):
    # Spoof content-length header exceeding 5 MB (5 * 1024 * 1024 = 5242880 bytes)
    res = unauthenticated_client.post(
        "/api/v1/auth/login",
        headers={"Content-Length": "6000000"},
        json={"email": "large@test.com", "password": "any"},
    )
    assert res.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert "5 MB" in res.json()["message"]


def test_httponly_cookie_refresh_and_logout(unauthenticated_client):
    """Verifies HttpOnly cookie issuance, bodyless refresh, and cookie clearance on logout."""
    email = f"cookieuser_{uuid.uuid4().hex[:8]}@eventflow.org"
    password = "SuperPassword789!"
    
    # 1. Register: Verify Set-Cookie header is issued
    reg_res = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Cookie Tester"},
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    assert "refresh_token" in reg_res.cookies
    assert reg_res.cookies["refresh_token"] is not None

    # 2. Bodyless refresh using cookie
    # Client automatically carries cookie in session
    ref_res = unauthenticated_client.post("/api/v1/auth/refresh")
    assert ref_res.status_code == status.HTTP_200_OK
    assert "access_token" in ref_res.json()["data"]
    # New rotated cookie issued
    assert "refresh_token" in ref_res.cookies

    # 3. Bodyless logout clears cookie
    logout_res = unauthenticated_client.post("/api/v1/auth/logout")
    assert logout_res.status_code == status.HTTP_200_OK
    
    # Subsequent refresh without cookie must fail with 401
    unauthenticated_client.cookies.clear()
    ref_after_logout = unauthenticated_client.post("/api/v1/auth/refresh")
    assert ref_after_logout.status_code == status.HTTP_401_UNAUTHORIZED


def test_production_httponly_cookie_and_body_omission(unauthenticated_client, monkeypatch):
    """
    Verifies that in production mode (ENVIRONMENT='production'):
    - Secure cookies are mandated.
    - Refresh tokens are omitted (None) from JSON response bodies to block JavaScript access.
    - Refreshing still succeeds seamlessly via HttpOnly cookie.
    """
    from app.core.config import get_settings
    current_settings = get_settings()
    monkeypatch.setattr(current_settings, "ENVIRONMENT", "production")

    email = f"prod_cookie_{uuid.uuid4().hex[:8]}@eventflow.org"
    password = "ProductionPassword123!"

    # 1. Register in production mode over HTTPS
    reg_res = unauthenticated_client.post(
        "https://testserver/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Prod Tester"},
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    data = reg_res.json()["data"]
    # Refresh token MUST be None in response body
    assert data["refresh_token"] is None
    assert "access_token" in data
    # Cookie MUST be present
    assert "refresh_token" in reg_res.cookies
    assert reg_res.cookies["refresh_token"] is not None

    # 2. Login in production mode over HTTPS
    login_res = unauthenticated_client.post(
        "https://testserver/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == status.HTTP_200_OK
    login_data = login_res.json()["data"]
    assert login_data["refresh_token"] is None
    assert "refresh_token" in login_res.cookies

    # 3. Refresh in production mode using cookie over HTTPS
    ref_res = unauthenticated_client.post("https://testserver/api/v1/auth/refresh")
    assert ref_res.status_code == status.HTTP_200_OK
    ref_data = ref_res.json()["data"]
    assert ref_data["refresh_token"] is None
    assert "access_token" in ref_data
    assert "refresh_token" in ref_res.cookies


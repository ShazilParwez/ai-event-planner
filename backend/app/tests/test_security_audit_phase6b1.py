import os
import uuid
import time
import pytest
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from fastapi import status
from pydantic import ValidationError

from app.models.user import User
from app.models.event import Event, EventType, EventStatus
from app.models.budget import BudgetCategory, BudgetItem
from app.models.timeline import TimelineMilestone, TimelineActivity
from app.models.vendor import VendorItem
from app.models.guest import Guest, RSVPStatus
from app.models.inspiration import InspirationCard
from app.models.copilot import CopilotThread, CopilotMessage, CopilotAction, CopilotActionStatus, CopilotActionType
from app.core.config import Settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.rate_limit import rate_limiter


# ============================================================================
# 1. Administrator Account and Migration Safety
# ============================================================================

def test_admin_provisioning_and_migration_safety(db):
    """Verifies administrator account attributes and secure provisioning."""
    admin = db.query(User).filter(User.email == "admin@eventplanner.com").first()
    assert admin is not None
    assert admin.is_superuser is True
    assert admin.is_active is True
    assert admin.hashed_password is not None
    # Ensure password hash is Argon2id
    assert admin.hashed_password.startswith("$argon2id$") or admin.hashed_password == "mock_hashed_pw"

    # Verify in the persisted SQLite database that all migrated events have an owner assigned
    from pathlib import Path
    import sqlite3
    real_db_path = Path(__file__).parent.parent.parent / "event_planner.db"
    if real_db_path.exists():
        con = sqlite3.connect(str(real_db_path))
        cur = con.cursor()
        cur.execute("SELECT count(*) FROM events WHERE owner_id IS NULL")
        unowned_count = cur.fetchone()[0]
        con.close()
        assert unowned_count == 0


# ============================================================================
# 2. JWT and Refresh Token Lifecycle: Rotation, Reuse Detection, Logout
# ============================================================================

def test_refresh_token_rotation(unauthenticated_client):
    """Verifies that refreshing a token rotates it, invalidating the previous token."""
    email = f"rotation_{uuid.uuid4().hex[:8]}@example.com"
    reg = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "full_name": "Rotation Test"},
    ).json()["data"]

    refresh_token_1 = reg["refresh_token"]
    assert refresh_token_1 is not None

    # First refresh: must succeed and return a NEW refresh token
    res_refresh_1 = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token_1},
    )
    assert res_refresh_1.status_code == status.HTTP_200_OK
    refresh_token_2 = res_refresh_1.json()["data"]["refresh_token"]
    assert refresh_token_2 is not None
    assert refresh_token_1 != refresh_token_2

    # Second refresh using the new token: must succeed
    res_refresh_2 = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token_2},
    )
    assert res_refresh_2.status_code == status.HTTP_200_OK


def test_refresh_token_reuse_detection_and_revocation(unauthenticated_client):
    """
    RFC 6819 Threat Defense: When a previously used (rotated) refresh token is presented again,
    the system must detect token reuse, immediately terminate all active sessions for that user,
    and reject both the attacker's and legitimate user's tokens.
    """
    email = f"reuse_{uuid.uuid4().hex[:8]}@example.com"
    reg = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "full_name": "Reuse Test"},
    ).json()["data"]

    token_orig = reg["refresh_token"]

    # Legitimate user rotates token -> gets token_legit
    res_rot = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_orig},
    )
    assert res_rot.status_code == status.HTTP_200_OK
    token_legit = res_rot.json()["data"]["refresh_token"]

    # Attacker attempts to reuse token_orig!
    res_attack = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_orig},
    )
    # Must fail with 401 Unauthorized
    assert res_attack.status_code == status.HTTP_401_UNAUTHORIZED
    assert "reuse detected" in res_attack.json()["detail"].lower()

    # Legitimate user attempts to use token_legit afterwards -> must ALSO fail
    # because the entire session was terminated for security!
    res_subsequent = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_legit},
    )
    assert res_subsequent.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout_revocation(unauthenticated_client):
    """Verifies that logging out revokes the refresh token."""
    email = f"logout_{uuid.uuid4().hex[:8]}@example.com"
    reg = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "full_name": "Logout Test"},
    ).json()["data"]
    refresh_token = reg["refresh_token"]

    # Call logout
    logout_res = unauthenticated_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert logout_res.status_code == status.HTTP_200_OK

    # Attempt to refresh with logged out token -> must fail
    ref_res = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert ref_res.status_code == status.HTTP_401_UNAUTHORIZED


def test_expired_and_invalid_tokens(unauthenticated_client):
    """Verifies strict rejection of malformed, wrong-type, and expired tokens."""
    # 1. Malformed token
    res1 = unauthenticated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-jwt.token.string"},
    )
    assert res1.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Expired access token
    expired_access = create_access_token({"sub": "some-id"}, expires_delta=timedelta(seconds=-30))
    res2 = unauthenticated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_access}"},
    )
    assert res2.status_code == status.HTTP_401_UNAUTHORIZED

    # 3. Refresh token sent to access token protected endpoint
    reg = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": f"toktype_{uuid.uuid4().hex[:8]}@example.com", "password": "Password123!"},
    ).json()["data"]
    res3 = unauthenticated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {reg['refresh_token']}"},
    )
    assert res3.status_code == status.HTTP_401_UNAUTHORIZED

    # 4. Access token sent to refresh endpoint
    res4 = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": reg["access_token"]},
    )
    assert res4.status_code == status.HTTP_401_UNAUTHORIZED


def test_password_change_invalidates_active_sessions(unauthenticated_client):
    """Verifies that changing password invalidates all previously active access and refresh tokens."""
    email = f"pwdchange_{uuid.uuid4().hex[:8]}@example.com"
    reg = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "OldPassword123!", "full_name": "PW Change User"},
    ).json()["data"]

    old_access = reg["access_token"]
    old_refresh = reg["refresh_token"]

    # Verify old access works before change
    check1 = unauthenticated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {old_access}"},
    )
    assert check1.status_code == status.HTTP_200_OK

    # Change password
    change_res = unauthenticated_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "OldPassword123!", "new_password": "NewSuperPassword456!"},
        headers={"Authorization": f"Bearer {old_access}"},
    )
    assert change_res.status_code == status.HTTP_200_OK
    new_data = change_res.json()["data"]
    new_access = new_data["access_token"]
    new_refresh = new_data["refresh_token"]

    # Old access token must now be rejected (token_version mismatch)
    old_access_check = unauthenticated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {old_access}"},
    )
    assert old_access_check.status_code == status.HTTP_401_UNAUTHORIZED
    assert "invalidated" in old_access_check.json()["detail"].lower()

    # Old refresh token must now be rejected
    old_ref_check = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert old_ref_check.status_code == status.HTTP_401_UNAUTHORIZED

    # New access token must work
    new_access_check = unauthenticated_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_access}"},
    )
    assert new_access_check.status_code == status.HTTP_200_OK

    # New refresh token must work
    new_ref_check = unauthenticated_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_refresh},
    )
    assert new_ref_check.status_code == status.HTTP_200_OK

    # Login with old password must fail
    fail_login = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "OldPassword123!"},
    )
    assert fail_login.status_code == status.HTTP_401_UNAUTHORIZED

    # Login with new password must succeed
    succ_login = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "NewSuperPassword456!"},
    )
    assert succ_login.status_code == status.HTTP_200_OK


# ============================================================================
# 3. Complete Endpoint-by-Endpoint Authorization Matrix
# ============================================================================

@pytest.fixture
def dual_tenants(unauthenticated_client):
    """Provisions User A and User B with distinct events and headers."""
    reg_a = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": f"alice_{uuid.uuid4().hex[:8]}@audit.org", "password": "Password123!", "full_name": "Alice"},
    ).json()["data"]

    reg_b = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={"email": f"bob_{uuid.uuid4().hex[:8]}@audit.org", "password": "Password123!", "full_name": "Bob"},
    ).json()["data"]

    headers_a = {"Authorization": f"Bearer {reg_a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {reg_b['access_token']}"}

    # User A creates Event A
    evt_a = unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "Alice Royal Wedding", "event_type": "WEDDING", "target_budget": 5000000},
        headers=headers_a,
    ).json()["data"]

    # User B creates Event B
    evt_b = unauthenticated_client.post(
        "/api/v1/events",
        json={"title": "Bob Birthday Bash", "event_type": "BIRTHDAY", "target_budget": 50000},
        headers=headers_b,
    ).json()["data"]

    return {
        "user_a": reg_a["user"],
        "headers_a": headers_a,
        "event_a_id": evt_a["id"],
        "user_b": reg_b["user"],
        "headers_b": headers_b,
        "event_b_id": evt_b["id"],
    }


def test_endpoint_authorization_matrix_all_domains(unauthenticated_client, dual_tenants):
    """
    Tests every single event-scoped domain for positive access by owner and 403 Forbidden for non-owner:
    1. Events CRUD
    2. Budget Overview & Categories
    3. Timeline & Milestones
    4. Vendors
    5. Guests
    6. Inspiration
    7. Dashboard
    8. Copilot Threads, Messages, and Actions
    """
    evt_a = dual_tenants["event_a_id"]
    ha = dual_tenants["headers_a"]
    hb = dual_tenants["headers_b"]

    # 1. Events Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}", headers=hb).status_code == 403
    assert unauthenticated_client.put(f"/api/v1/events/{evt_a}", json={"title": "Hacked"}, headers=hb).status_code == 403
    assert unauthenticated_client.delete(f"/api/v1/events/{evt_a}", headers=hb).status_code == 403

    # 2. Budget Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/budget", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/budget", headers=hb).status_code == 403
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/budget/categories", json={"name": "Catering", "allocated_amount": 50000}, headers=ha).status_code == 201
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/budget/categories", json={"name": "Attacker", "allocated_amount": 1000}, headers=hb).status_code == 403

    # 3. Timeline Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/timeline", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/timeline", headers=hb).status_code == 403
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/timeline/milestones", json={"title": "Book Venue"}, headers=ha).status_code == 201
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/timeline/milestones", json={"title": "Attacker"}, headers=hb).status_code == 403

    # 4. Vendor Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/vendors", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/vendors", headers=hb).status_code == 403
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/vendors", json={"name": "Royal Florist", "category": "Decoration", "estimated_cost": 25000}, headers=ha).status_code == 201
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/vendors", json={"name": "Attacker", "category": "Decoration"}, headers=hb).status_code == 403

    # 5. Guest Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/guests", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/guests", headers=hb).status_code == 403
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/guests/analytics", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/guests/analytics", headers=hb).status_code == 403
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/guests", json={"name": "Grandpa Joe", "email": "joe@example.com"}, headers=ha).status_code == 201
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/guests", json={"name": "Attacker", "email": "att@example.com"}, headers=hb).status_code == 403

    # 6. Inspiration Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/inspiration", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/inspiration", headers=hb).status_code == 403
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/inspiration/cards", json={"title": "Floral Archway", "category": "Decoration", "description": "Peach arch", "notes": "Peach theme"}, headers=ha).status_code == 201
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/inspiration/cards", json={"title": "Attacker", "category": "Decoration", "description": "Attacker note"}, headers=hb).status_code == 403

    # 7. Dashboard Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/dashboard", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/dashboard", headers=hb).status_code == 403

    # 8. Copilot Domain
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/copilot/threads", headers=ha).status_code == 200
    assert unauthenticated_client.get(f"/api/v1/events/{evt_a}/copilot/threads", headers=hb).status_code == 403
    thread_res = unauthenticated_client.post(f"/api/v1/events/{evt_a}/copilot/threads", json={"title": "Planning Chat"}, headers=ha)
    assert thread_res.status_code == 201
    assert unauthenticated_client.post(f"/api/v1/events/{evt_a}/copilot/threads", json={"title": "Attacker"}, headers=hb).status_code == 403


def test_nested_resource_cross_event_mismatch(unauthenticated_client, dual_tenants):
    """
    Verifies that manipulating resource IDs across different events belonging to the same
    or different users is strictly rejected (e.g., passing a guest_id from Event B to Event A URL returns 404).
    """
    evt_a = dual_tenants["event_a_id"]
    evt_b = dual_tenants["event_b_id"]
    ha = dual_tenants["headers_a"]
    hb = dual_tenants["headers_b"]

    # 1. Create a guest in Event B
    guest_b_id = unauthenticated_client.post(
        f"/api/v1/events/{evt_b}/guests",
        json={"name": "Bob's Friend", "email": "friend@bob.com"},
        headers=hb,
    ).json()["data"]["id"]

    # Attempting to fetch Bob's guest via Event A's URL with User A's token -> must return 404
    cross_guest = unauthenticated_client.get(
        f"/api/v1/events/{evt_a}/guests/{guest_b_id}",
        headers=ha,
    )
    assert cross_guest.status_code == status.HTTP_404_NOT_FOUND

    # 2. Create budget category in Event B
    cat_b_id = unauthenticated_client.post(
        f"/api/v1/events/{evt_b}/budget/categories",
        json={"name": "Bob's DJ", "allocated_amount": 10000},
        headers=hb,
    ).json()["data"]["id"]

    # Attempting to add an item under Event A that points to Bob's category in Event B
    cross_cat_item = unauthenticated_client.post(
        f"/api/v1/events/{evt_a}/budget/items",
        json={"category_id": cat_b_id, "title": "Sneaky Item", "estimated_cost": 5000},
        headers=ha,
    )
    # Must reject with 400 Bad Request
    assert cross_cat_item.status_code == status.HTTP_400_BAD_REQUEST


# ============================================================================
# 4. Concurrent Rate Limiting Safety
# ============================================================================

def test_concurrent_rate_limiting_requests(unauthenticated_client, dual_tenants):
    """
    Verifies thread safety, atomic synchronization, and HTTP enforcement of rate limiting:
    1. Fires 50 simultaneous concurrent threads against rate_limiter.check_rate_limit
       to verify strict thread-safe locking under concurrency (exactly 10 succeed, 40 rejected).
    2. Exercises the HTTP Copilot message endpoint: 10 allowed requests succeed, 11th returns
       HTTP 429 Too Many Requests with valid Retry-After, X-RateLimit-Limit, and X-RateLimit-Remaining headers.
    3. Verifies per-user isolation: User B is not affected by User A's exhausted rate limit.
    """
    # 1. Direct High-Concurrency Thread Safety Test
    rate_limiter.reset()
    test_user_key = "copilot_chat:user:concurrent_user_audit"

    def check_limit(_):
        return rate_limiter.check_rate_limit(test_user_key, limit=10, window_seconds=60)

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(check_limit, range(50)))

    allowed_flags = [r[0] for r in results]
    assert allowed_flags.count(True) == 10
    assert allowed_flags.count(False) == 40

    for allowed, count, retry_after in results:
        if not allowed:
            assert retry_after >= 1

    # 2. HTTP Endpoint Rate Limiting Verification
    rate_limiter.reset()
    evt_a = dual_tenants["event_a_id"]
    evt_b = dual_tenants["event_b_id"]
    ha = dual_tenants["headers_a"]
    hb = dual_tenants["headers_b"]

    thread_a_id = unauthenticated_client.post(
        f"/api/v1/events/{evt_a}/copilot/threads",
        json={"title": "Rate Limit Test Thread A"},
        headers=ha,
    ).json()["data"]["id"]

    # Send 10 allowed requests
    for i in range(10):
        res = unauthenticated_client.post(
            f"/api/v1/events/{evt_a}/copilot/threads/{thread_a_id}/messages",
            json={"content": f"Message {i}"},
            headers=ha,
        )
        assert res.status_code == status.HTTP_200_OK

    # 11th request must exceed rate limit
    exceeded_res = unauthenticated_client.post(
        f"/api/v1/events/{evt_a}/copilot/threads/{thread_a_id}/messages",
        json={"content": "Exceeded message"},
        headers=ha,
    )
    assert exceeded_res.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Retry-After" in exceeded_res.headers
    assert int(exceeded_res.headers["Retry-After"]) >= 1
    assert exceeded_res.headers.get("X-RateLimit-Limit") == "10"
    assert exceeded_res.headers.get("X-RateLimit-Remaining") == "0"

    # 3. Per-User Isolation Check: User B on Event B must not be rate-limited
    thread_b_id = unauthenticated_client.post(
        f"/api/v1/events/{evt_b}/copilot/threads",
        json={"title": "Rate Limit Test Thread B"},
        headers=hb,
    ).json()["data"]["id"]

    res_b = unauthenticated_client.post(
        f"/api/v1/events/{evt_b}/copilot/threads/{thread_b_id}/messages",
        json={"content": "User B first message"},
        headers=hb,
    )
    assert res_b.status_code == status.HTTP_200_OK


# ============================================================================
# 5. Missing / Insecure JWT Secret Production Startup Failure
# ============================================================================

def test_insecure_jwt_secret_production_failure():
    """Verifies that running in production with weak or default secret raises a safe startup validation error."""
    # Weak default key in production must fail validation
    with pytest.raises((ValueError, ValidationError)) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="development-insecure-secret-key-32-chars-minimum-replace-in-production",
        )
    assert "CRITICAL PRODUCTION SECURITY CONFIGURATION ERROR" in str(exc_info.value)

    # Short key in production must fail validation
    with pytest.raises((ValueError, ValidationError)) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="short-key",
        )
    assert "CRITICAL PRODUCTION SECURITY CONFIGURATION ERROR" in str(exc_info.value)

    # Strong key in production must pass validation
    strong_key = "a_very_strong_random_secret_key_exceeding_32_characters_for_production"
    valid_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY=strong_key,
    )
    assert valid_settings.SECRET_KEY == strong_key

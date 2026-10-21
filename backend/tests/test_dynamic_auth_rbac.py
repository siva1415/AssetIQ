import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.app_user import AppUser
from app.models.asset import Asset


def test_1_valid_login_active_user(client: TestClient):
    """
    Test 1: Valid login for an active user.
    - Verifies password against bcrypt hash in app_users
    - Returns token, ID, username, full_name, email, role, must_reset_password flag, and menu permissions
    - Updates last_login_at
    """
    payload = {
        "username": "superadmin",
        "password": "SuperAdmin@123",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["token_type"] == "bearer"
    assert "access_token" in data and len(data["access_token"]) > 20
    assert data["username"] == "superadmin"
    assert data["role"] == "SUPERADMIN"
    assert data["status"] == "ACTIVE"
    assert data["must_reset_password"] is False
    assert "User Management" in data["permissions"]
    assert "Job Scheduler" in data["permissions"]
    assert "Audit Logs" in data["permissions"]
    assert "Settings" in data["permissions"]
    assert data["last_login_at"] is not None


def test_2_invalid_credentials_rejected(client: TestClient):
    """
    Test 2: Invalid username and/or password rejected with generic error message.
    """
    # Bad username
    res1 = client.post(
        "/api/auth/login",
        json={"username": "nonexistent_user_999", "password": "AnyPassword123"}
    )
    assert res1.status_code == 401
    assert "Invalid username or password" in res1.json()["detail"]

    # Valid username, bad password
    res2 = client.post(
        "/api/auth/login",
        json={"username": "superadmin", "password": "WrongPassword!@#"}
    )
    assert res2.status_code == 401
    assert "Invalid username or password" in res2.json()["detail"]


def test_3_inactive_user_login_rejection(client: TestClient):
    """
    Test 3: Reject users whose status is INACTIVE even with correct password.
    """
    payload = {
        "username": "inactive_user",
        "password": "Inactive@123",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 403
    assert "inactive" in response.json()["detail"].lower()


def test_4_first_login_mandatory_password_reset(client: TestClient):
    """
    Test 4: First-login password reset behavior.
    - New user logs in with temporary password test@123
    - must_reset_password is True
    - Attempting normal application APIs fails with HTTP 403
    - Password change endpoint remains accessible
    """
    login_res = client.post(
        "/api/auth/login",
        json={"username": "newhire", "password": "test@123"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert login_res.json()["must_reset_password"] is True

    headers = {"Authorization": f"Bearer {token}"}

    # Accessing protected asset or user API before reset must be rejected with HTTP 403
    res_assets = client.get("/api/assets", headers=headers)
    assert res_assets.status_code == 403
    assert "password" in res_assets.json()["detail"].lower()

    res_users = client.get("/api/app-users", headers=headers)
    assert res_users.status_code == 403

    # But /api/auth/change-password is accessible
    change_payload = {
        "current_password": "test@123",
        "new_password": "NewPermanentPass@2026",
    }
    change_res = client.post("/api/auth/change-password", json=change_payload, headers=headers)
    assert change_res.status_code == 200, change_res.text
    data = change_res.json()
    assert data["must_reset_password"] is False


def test_5_login_with_new_password_after_reset(client: TestClient):
    """
    Test 5: Login with the new password after reset and verify normal access is granted.
    """
    # 1. Login with temporary password
    res1 = client.post("/api/auth/login", json={"username": "newhire", "password": "test@123"})
    token1 = res1.json()["access_token"]

    # 2. Change password
    client.post(
        "/api/auth/change-password",
        json={"current_password": "test@123", "new_password": "BrandNewPassword@456"},
        headers={"Authorization": f"Bearer {token1}"}
    )

    # 3. Old temporary password no longer works
    res_old = client.post("/api/auth/login", json={"username": "newhire", "password": "test@123"})
    assert res_old.status_code == 401

    # 4. New password logs in successfully with must_reset_password=False
    res_new = client.post("/api/auth/login", json={"username": "newhire", "password": "BrandNewPassword@456"})
    assert res_new.status_code == 200
    token2 = res_new.json()["access_token"]
    assert res_new.json()["must_reset_password"] is False

    # 5. Normal access is now granted
    res_assets = client.get("/api/assets", headers={"Authorization": f"Bearer {token2}"})
    assert res_assets.status_code == 200


def test_6_creation_and_management_all_three_roles(client: TestClient):
    """
    Test 6: Creation and management of users with all three roles (SUPERADMIN, ADMIN, VIEWER).
    - SUPERADMIN creates an ADMIN and a VIEWER
    - Both get default temporary password test@123 and must_reset_password=True
    - Role and status are retrieved and listed properly
    """
    # Login as SUPERADMIN
    login_super = client.post("/api/auth/login", json={"username": "superadmin", "password": "SuperAdmin@123"})
    super_token = login_super.json()["access_token"]
    headers = {"Authorization": f"Bearer {super_token}"}

    # 1. Create ADMIN
    admin_payload = {
        "username": "ops_lead",
        "full_name": "Operations Lead",
        "email": "ops.lead@enterprise.com",
        "role": "ADMIN",
    }
    res_admin = client.post("/api/app-users", json=admin_payload, headers=headers)
    assert res_admin.status_code == 201, res_admin.text
    admin_data = res_admin.json()
    assert admin_data["username"] == "ops_lead"
    assert admin_data["role"] == "ADMIN"
    assert admin_data["status"] == "ACTIVE"
    assert admin_data["must_reset_password"] is True
    assert "User Management" in admin_data["permissions"]

    # 2. Create VIEWER
    viewer_payload = {
        "username": "auditor_guest",
        "full_name": "Auditor Guest",
        "email": "auditor@enterprise.com",
        "role": "VIEWER",
    }
    res_viewer = client.post("/api/app-users", json=viewer_payload, headers=headers)
    assert res_viewer.status_code == 201, res_viewer.text
    viewer_data = res_viewer.json()
    assert viewer_data["username"] == "auditor_guest"
    assert viewer_data["role"] == "VIEWER"
    assert "User Management" not in viewer_data["permissions"]

    # 3. Create another SUPERADMIN
    super2_payload = {
        "username": "deputy_super",
        "full_name": "Deputy Superadmin",
        "email": "deputy@enterprise.com",
        "role": "SUPERADMIN",
    }
    res_super2 = client.post("/api/app-users", json=super2_payload, headers=headers)
    assert res_super2.status_code == 201
    assert res_super2.json()["role"] == "SUPERADMIN"

    # 4. List users
    res_list = client.get("/api/app-users", headers=headers)
    assert res_list.status_code == 200
    user_names = [u["username"] for u in res_list.json()["items"]]
    assert "ops_lead" in user_names
    assert "auditor_guest" in user_names
    assert "deputy_super" in user_names


def test_7_admin_restrictions_on_superadmin(client: TestClient):
    """
    Test 7: ADMIN restrictions on SUPERADMIN accounts.
    - ADMIN cannot create a SUPERADMIN
    - ADMIN cannot modify a SUPERADMIN account
    - ADMIN cannot promote a user to SUPERADMIN
    - ADMIN cannot deactivate a SUPERADMIN account
    - ADMIN cannot reset password for a SUPERADMIN account
    """
    login_admin = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. ADMIN cannot create a SUPERADMIN
    res_create = client.post(
        "/api/app-users",
        json={
            "username": "illegal_super",
            "full_name": "Illegal Super",
            "email": "illegal@enterprise.com",
            "role": "SUPERADMIN",
        },
        headers=admin_headers,
    )
    assert res_create.status_code == 403
    assert "superadmin" in res_create.json()["detail"].lower()

    # 2. ADMIN cannot modify a SUPERADMIN account (user_id=1 is superadmin)
    res_modify = client.put(
        "/api/app-users/1",
        json={"full_name": "Tampered Name"},
        headers=admin_headers,
    )
    assert res_modify.status_code == 403

    # 3. ADMIN cannot promote an ordinary user to SUPERADMIN (user_id=3 is viewer)
    res_promote = client.put(
        "/api/app-users/3",
        json={"role": "SUPERADMIN"},
        headers=admin_headers,
    )
    assert res_promote.status_code == 403

    # 4. ADMIN cannot deactivate a SUPERADMIN account
    res_deact = client.patch(
        "/api/app-users/1/status",
        json={"status": "INACTIVE"},
        headers=admin_headers,
    )
    assert res_deact.status_code == 403

    # 5. ADMIN cannot reset password for a SUPERADMIN account
    res_reset = client.post(
        "/api/app-users/1/reset-password",
        headers=admin_headers,
    )
    assert res_reset.status_code == 403


def test_8_viewer_write_operation_restrictions(client: TestClient):
    """
    Test 8: VIEWER role write-operation restrictions.
    - VIEWER cannot perform bulk asset assignment
    - VIEWER cannot perform single asset assignment
    - VIEWER cannot create, update, or deactivate users
    """
    login_viewer = client.post("/api/auth/login", json={"username": "viewer", "password": "Viewer@123"})
    viewer_token = login_viewer.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    # 1. Asset bulk assignment -> 403 Forbidden
    res_bulk = client.post(
        "/api/assets/bulk-assign",
        json={"asset_ids": [1], "assigned_username": "johndoe", "managed_by": "INDIVIDUAL"},
        headers=viewer_headers,
    )
    assert res_bulk.status_code == 403
    assert "viewer" in res_bulk.json()["detail"].lower() or "privileges" in res_bulk.json()["detail"].lower()

    # 2. Single asset assignment -> 403 Forbidden
    res_assign = client.post(
        "/api/assets/1/assign",
        json={"assigned_username": "johndoe", "managed_by": "INDIVIDUAL"},
        headers=viewer_headers,
    )
    assert res_assign.status_code == 403

    # 3. User management APIs -> 403 Forbidden
    res_users = client.get("/api/app-users", headers=viewer_headers)
    assert res_users.status_code == 403

    res_user_create = client.post(
        "/api/app-users",
        json={"username": "test", "full_name": "Test", "email": "t@t.com", "role": "VIEWER"},
        headers=viewer_headers,
    )
    assert res_user_create.status_code == 403


def test_9_prevention_of_deactivating_last_active_superadmin(client: TestClient):
    """
    Test 9: Prevention of deactivating the last active SUPERADMIN.
    - When only 1 active SUPERADMIN exists, attempting to deactivate returns error
    - When a 2nd active SUPERADMIN exists, one can be deactivated safely
    """
    login_super = client.post("/api/auth/login", json={"username": "superadmin", "password": "SuperAdmin@123"})
    super_token = login_super.json()["access_token"]
    headers = {"Authorization": f"Bearer {super_token}"}

    # Initially user_id=1 is the only SUPERADMIN in db
    res_deact1 = client.patch(
        "/api/app-users/1/status",
        json={"status": "INACTIVE"},
        headers=headers,
    )
    assert res_deact1.status_code in (400, 403)
    assert "last active superadmin" in res_deact1.json()["detail"].lower()

    # Create a 2nd SUPERADMIN
    client.post(
        "/api/app-users",
        json={
            "username": "second_super",
            "full_name": "Second Super",
            "email": "second.super@enterprise.com",
            "role": "SUPERADMIN",
        },
        headers=headers,
    )

    # Now deactivating user_id=1 succeeds because second_super is active
    res_deact2 = client.patch(
        "/api/app-users/1/status",
        json={"status": "INACTIVE"},
        headers=headers,
    )
    assert res_deact2.status_code == 200
    assert res_deact2.json()["status"] == "INACTIVE"


def test_10_existing_apis_remain_functional(client: TestClient):
    """
    Test 10: Existing APIs remain functional.
    - Health check (/health and /api/health)
    - Dashboard summary (/api/dashboard/summary)
    - Hardware inventory (/api/assets)
    - Workday employees (/api/employees)
    - EOL references (/api/eol-reference)
    - Admin users (/api/admin-users)
    """
    # 1. Health check
    h = client.get("/health")
    assert h.status_code in (200, 503)

    # 2. Dashboard summary
    d = client.get("/api/dashboard/summary")
    assert d.status_code == 200
    assert "total_assets" in d.json() or "totalAssets" in d.json()

    # 3. Hardware inventory
    a = client.get("/api/assets")
    assert a.status_code == 200
    assert "items" in a.json()

    # 4. Workday employees
    e = client.get("/api/employees")
    assert e.status_code == 200

    # 5. EOL references
    eol = client.get("/api/eol-reference")
    assert eol.status_code == 200

    # 6. Admin users
    au = client.get("/api/admin-users")
    assert au.status_code == 200


def test_real_time_database_revocation(client: TestClient, db_session: Session):
    """
    Verify requirement E:
    Stale JWT token claims cannot bypass current database authorization.
    If an active admin has their account deactivated in the database,
    subsequent requests using their existing unexpired token are immediately rejected.
    """
    # 1. Login as admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verify access works
    res1 = client.get("/api/app-users", headers=headers)
    assert res1.status_code == 200

    # 3. Direct DB update: set status to INACTIVE
    admin_entity = db_session.get(AppUser, 2)
    admin_entity.status = "INACTIVE"
    db_session.commit()

    # 4. Subsequent request with the token is immediately rejected
    res2 = client.get("/api/app-users", headers=headers)
    assert res2.status_code == 403
    assert "inactive" in res2.json()["detail"].lower()

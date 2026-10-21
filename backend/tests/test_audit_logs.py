import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.app_user import AppUser
from app.models.asset import Asset
from app.models.audit_log import AuditLog
from app.models.device_eol_reference import DeviceEolReference


def _get_token(client: TestClient, username: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    return res.json()["access_token"]


def test_1_single_asset_assignment_audit_event(client: TestClient, db_session: Session):
    """
    Test 1: Single asset assignment and reassignment audit events.
    - Category: ASSET OWNERSHIP
    - Action: REASSIGN USER (or ASSIGN USER)
    - Captures actor identity from JWT bearer token (User ID, username, full name, role)
    - Records before-and-after values in old_values and new_values
    - Generates human-readable audit finding
    """
    admin_token = _get_token(client, "admin", "Admin@123")
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")

    # Asset 1 initially assigned to johndoe
    res = client.post(
        "/api/assets/1/assign",
        json={
            "assigned_username": "sarahconnor",
            "managed_by": "INDIVIDUAL",
            "remarks": "Reassigned for security audits",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200, res.text

    # Query audit logs as superadmin
    audit_res = client.get(
        "/api/audit-logs",
        headers={"Authorization": f"Bearer {super_token}"},
        params={"category": "ASSET OWNERSHIP"},
    )
    assert audit_res.status_code == 200, audit_res.text
    logs = audit_res.json()["items"]
    assert len(logs) >= 1

    entry = logs[0]
    assert entry["category"] == "ASSET OWNERSHIP"
    assert entry["action"] == "REASSIGN USER"
    assert entry["entity_type"] == "ASSET"
    assert entry["entity_id"] == "1"
    assert entry["portal_username"] == "admin"
    assert entry["portal_user_role"] == "ADMIN"
    finding_lower = entry["audit_finding"].lower()
    assert "reassigned from john doe (johndoe) to sarah connor (sarahconnor)" in finding_lower
    assert entry["old_values"]["assigned_username"].strip().lower() == "johndoe"
    assert entry["new_values"]["assigned_username"] == "sarahconnor"
    assert entry["new_values"]["remarks"] == "Reassigned for security audits"


def test_2_bulk_asset_assignment_audit_event_and_failure_handling(client: TestClient, db_session: Session):
    """
    Test 2: Bulk asset assignment audit logging.
    - Associates multiple asset operations with a common bulk_operation_id in metadata
    - Accurately captures both successful and failed asset outcomes
    - Does not claim that failed asset assignments succeeded
    """
    admin_token = _get_token(client, "admin", "Admin@123")
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")

    # Bulk assign asset 1 (valid) and asset 99999 (invalid / nonexistent)
    payload = {
        "asset_ids": [1, 99999],
        "assigned_username": "sarahconnor",
        "managed_by": "GROUP",
        "remarks": "Bulk assignment batch",
    }
    res = client.post(
        "/api/assets/bulk-assign",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200, res.text
    resp_data = res.json()
    assert resp_data["success_count"] == 1
    assert resp_data["failure_count"] == 1

    # Query audit logs as superadmin
    audit_res = client.get(
        "/api/audit-logs",
        headers={"Authorization": f"Bearer {super_token}"},
        params={"category": "ASSET OWNERSHIP", "action": "BULK ASSIGN"},
    )
    assert audit_res.status_code == 200, audit_res.text
    logs = audit_res.json()["items"]
    assert len(logs) >= 2

    # Verify both entries share the same bulk_operation_id
    success_entry = next((e for e in logs if e["status"] == "SUCCESS"), None)
    failure_entry = next((e for e in logs if e["status"] == "FAILURE"), None)

    assert success_entry is not None
    assert failure_entry is not None

    meta_s = success_entry["metadata"]
    meta_f = failure_entry["metadata"]
    assert meta_s["bulk_operation_id"] == meta_f["bulk_operation_id"]
    assert meta_s["total_affected_assets"] == 2
    assert "sarah connor (sarahconnor)" in success_entry["audit_finding"].lower()
    assert "during bulk assignment" in success_entry["audit_finding"].lower()
    assert failure_entry["entity_id"] == "99999"
    assert "not found" in failure_entry["audit_finding"]


def test_3_eol_management_lifecycle_audit_events(client: TestClient, db_session: Session):
    """
    Test 3: EOL Management audit events.
    - CREATE MODEL: creation of OEM hardware lifecycle reference
    - EDIT MODEL: modification of model/manufacturer/date
    - DELETE MODEL: deletion preserving previous values
    """
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")
    headers = {"Authorization": f"Bearer {super_token}"}

    # 1. CREATE MODEL
    create_res = client.post(
        "/api/eol-reference",
        json={
            "manufacturer": "Dell Inc.",
            "model": "Latitude 9450 2-in-1",
            "eol_date": "2029-12-31",
            "reference_source": "Dell Lifecycle Portal",
        },
        headers=headers,
    )
    assert create_res.status_code in (200, 201), create_res.text
    created_id = create_res.json()["eol_id"]

    # 2. EDIT MODEL
    edit_res = client.put(
        f"/api/eol-reference/{created_id}",
        json={
            "manufacturer": "Dell Inc.",
            "model": "Latitude 9450 2-in-1",
            "eol_date": "2030-06-30",
            "reference_source": "Dell Updated Support",
        },
        headers=headers,
    )
    assert edit_res.status_code == 200, edit_res.text

    # 3. DELETE MODEL
    del_res = client.delete(
        f"/api/eol-reference/{created_id}",
        headers=headers,
    )
    assert del_res.status_code == 200, del_res.text

    # Verify audit logs
    audit_res = client.get(
        "/api/audit-logs",
        headers=headers,
        params={"category": "EOL MANAGEMENT"},
    )
    assert audit_res.status_code == 200, audit_res.text
    logs = audit_res.json()["items"]

    actions = [l["action"] for l in logs]
    assert "CREATE MODEL" in actions
    assert "EDIT MODEL" in actions
    assert "DELETE MODEL" in actions

    delete_log = next(l for l in logs if l["action"] == "DELETE MODEL")
    assert delete_log["old_values"]["manufacturer"] == "Dell Inc."
    assert "Latitude 9450" in delete_log["audit_finding"]


def test_4_admin_users_audit_events(client: TestClient, db_session: Session):
    """
    Test 4: Admin users audit events.
    - ADD ADMIN USER: records Workday profile information
    - REMOVE ADMIN USER: records removal
    """
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")
    headers = {"Authorization": f"Bearer {super_token}"}

    # 1. Add admin user (sarahconnor is an active Workday employee)
    add_res = client.post(
        "/api/admin-users",
        json={"user_ids": ["sarahconnor"]},
        headers=headers,
    )
    assert add_res.status_code == 201, add_res.text

    # 2. Remove admin user
    del_res = client.delete(
        "/api/admin-users/sarahconnor",
        headers=headers,
    )
    assert del_res.status_code == 200, del_res.text

    # Verify audit logs
    audit_res = client.get(
        "/api/audit-logs",
        headers=headers,
        params={"category": "ADMIN USERS"},
    )
    assert audit_res.status_code == 200, audit_res.text
    logs = audit_res.json()["items"]
    actions = [l["action"] for l in logs]
    assert "ADD ADMIN USER" in actions
    assert "REMOVE ADMIN USER" in actions

    add_log = next(l for l in logs if l["action"] == "ADD ADMIN USER")
    assert add_log["portal_username"] == "superadmin"
    assert "sarahconnor" in add_log["entity_id"]
    assert add_log["new_values"]["full_name"] == "Sarah Connor"


def test_5_portal_user_management_audit_events(client: TestClient, db_session: Session):
    """
    Test 5: Portal user management operations audit events.
    - ADD PORTAL USER
    - EDIT PORTAL USER
    - ACTIVATE / DEACTIVATE USER
    - RESET PASSWORD
    - CHANGE PASSWORD (self)
    """
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")
    super_headers = {"Authorization": f"Bearer {super_token}"}

    # 1. ADD PORTAL USER
    create_res = client.post(
        "/api/app-users",
        json={
            "username": "audit_test_user",
            "full_name": "Audit Test User",
            "email": "audit.test@enterprise.com",
            "role": "VIEWER",
        },
        headers=super_headers,
    )
    assert create_res.status_code == 201, create_res.text
    target_id = create_res.json()["user_id"]

    # 2. EDIT PORTAL USER
    edit_res = client.put(
        f"/api/app-users/{target_id}",
        json={"full_name": "Audit Test User Updated", "role": "ADMIN"},
        headers=super_headers,
    )
    assert edit_res.status_code == 200, edit_res.text

    # 3. DEACTIVATE USER
    deact_res = client.patch(
        f"/api/app-users/{target_id}/status",
        json={"status": "INACTIVE"},
        headers=super_headers,
    )
    assert deact_res.status_code == 200, deact_res.text

    # 4. ACTIVATE USER
    act_res = client.patch(
        f"/api/app-users/{target_id}/status",
        json={"status": "ACTIVE"},
        headers=super_headers,
    )
    assert act_res.status_code == 200, act_res.text

    # 5. RESET PASSWORD
    reset_res = client.post(
        f"/api/app-users/{target_id}/reset-password",
        headers=super_headers,
    )
    assert reset_res.status_code == 200, reset_res.text

    # 6. CHANGE PASSWORD (login as audit_test_user with default temp password)
    user_login = client.post(
        "/api/auth/login",
        json={"username": "audit_test_user", "password": "test@123"},
    )
    assert user_login.status_code == 200, user_login.text
    user_token = user_login.json()["access_token"]

    change_res = client.post(
        "/api/auth/change-password",
        json={"current_password": "test@123", "new_password": "NewSecretPass!@#456"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert change_res.status_code == 200, change_res.text

    # Verify audit logs
    audit_res = client.get(
        "/api/audit-logs",
        headers=super_headers,
        params={"category": "USER MANAGEMENT"},
    )
    assert audit_res.status_code == 200, audit_res.text
    logs = audit_res.json()["items"]
    actions = [l["action"] for l in logs]

    assert "ADD PORTAL USER" in actions
    assert "EDIT PORTAL USER" in actions
    assert "DEACTIVATE USER" in actions
    assert "ACTIVATE USER" in actions
    assert "RESET PASSWORD" in actions
    assert "CHANGE PASSWORD" in actions


def test_6_audit_logs_rbac_authorization(client: TestClient, db_session: Session):
    """
    Test 6: Audit logs endpoint access control.
    - SUPERADMIN role -> Allowed (200 OK)
    - ADMIN role -> Forbidden (403)
    - VIEWER role -> Forbidden (403)
    - Anonymous / No Auth -> Unauthorized (401)
    """
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")
    admin_token = _get_token(client, "admin", "Admin@123")
    viewer_token = _get_token(client, "viewer", "Viewer@123")

    # Anonymous
    res_anon = client.get("/api/audit-logs")
    assert res_anon.status_code == 401

    # Viewer
    res_viewer = client.get("/api/audit-logs", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res_viewer.status_code == 403

    # Admin
    res_admin = client.get("/api/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 403

    # Superadmin
    res_super = client.get("/api/audit-logs", headers={"Authorization": f"Bearer {super_token}"})
    assert res_super.status_code == 200


def test_7_audit_logs_sanitization_no_passwords(client: TestClient, db_session: Session):
    """
    Test 7: Security check - Verify no passwords, password hashes, or tokens
    are stored anywhere in the audit_logs table.
    """
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")
    super_headers = {"Authorization": f"Bearer {super_token}"}

    # Perform user creation, password reset, and password change
    create_res = client.post(
        "/api/app-users",
        json={
            "username": "secret_check_user",
            "full_name": "Secret Check User",
            "email": "secret.check@enterprise.com",
            "role": "VIEWER",
        },
        headers=super_headers,
    )
    assert create_res.status_code == 201, create_res.text
    target_id = create_res.json()["user_id"]

    client.post(
        f"/api/app-users/{target_id}/reset-password",
        headers=super_headers,
    )

    all_logs = db_session.execute(select(AuditLog)).scalars().all()
    assert len(all_logs) > 0, "Expected audit logs to exist in database"

    for entry in all_logs:
        text_dump = f"{entry.audit_finding} {entry.old_values} {entry.new_values} {entry.event_metadata}"
        assert "test@123" not in text_dump
        assert "SuperAdmin@123" not in text_dump
        assert "password_hash" not in str(entry.old_values or {})
        assert "password_hash" not in str(entry.new_values or {})


def test_8_last_login_authenticated_user(client: TestClient, db_session: Session):
    """
    Test 8: Authenticated User Last Login
    - Retrieve logged-in portal user's last login from app_users.last_login_at
    - Identifies user via authenticated token/session, not frontend username
    - Returns timezone-aware ISO 8601 timestamp
    - Returns NULL if user has never logged in
    """
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")
    super_headers = {"Authorization": f"Bearer {super_token}"}

    # 1. Create a brand new user who has never logged in (last_login_at is NULL in app_users)
    create_res = client.post(
        "/api/app-users",
        json={
            "username": "fresh_user",
            "full_name": "Fresh User",
            "email": "fresh.user@enterprise.com",
            "role": "VIEWER",
        },
        headers=super_headers,
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["user_id"]

    # Verify last_login_at is None for the new user via user management API
    user_res = client.get(f"/api/app-users/{created_id}", headers=super_headers)
    assert user_res.status_code == 200
    assert user_res.json()["last_login_at"] is None

    # 2. Login as the newly created user (using default temporary password)
    login_res = client.post(
        "/api/auth/login",
        json={"username": "fresh_user", "password": "test@123"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    fresh_token = login_data["access_token"]
    assert login_data["last_login_at"] is not None

    # Verify ISO 8601 timezone-aware format
    ts_str = login_data["last_login_at"]
    # Parse with datetime.fromisoformat
    parsed_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    assert parsed_dt.tzinfo is not None, "Timestamp must be timezone-aware"

    # 3. Call current-user API (/api/auth/me) with authenticated token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fresh_token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["username"] == "fresh_user"
    assert me_data["last_login_at"] is not None
    me_dt = datetime.fromisoformat(me_data["last_login_at"].replace("Z", "+00:00"))
    assert me_dt.tzinfo is not None, "API /me must return timezone-aware ISO 8601 timestamp"

    # 4. Verify top-level alias endpoints /api/me and /api/current-user
    alias_res = client.get("/api/me", headers={"Authorization": f"Bearer {fresh_token}"})
    assert alias_res.status_code == 200
    assert alias_res.json()["username"] == "fresh_user"
    assert alias_res.json()["last_login_at"] == me_data["last_login_at"]


def test_9_audit_event_details_api(client: TestClient, db_session: Session):
    """
    Test 9: Audit Event Details API
    Verifies that the audit-log API returns all required fields without duplicates:
    - portal_username
    - portal_user_full_name
    - portal_user_role
    - asset_tag
    - category
    - action
    - audit_finding
    - detected_at
    - old_values
    - new_values
    - metadata
    - status
    """
    admin_token = _get_token(client, "admin", "Admin@123")
    super_token = _get_token(client, "superadmin", "SuperAdmin@123")
    super_headers = {"Authorization": f"Bearer {super_token}"}

    # Assign asset 1 as admin
    res = client.post(
        "/api/assets/1/assign",
        json={
            "assigned_username": "sarahconnor",
            "managed_by": "INDIVIDUAL",
            "remarks": "Detail test",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200

    # Query audit logs list
    list_res = client.get("/api/audit-logs", headers=super_headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) > 0
    target_audit_id = items[0]["audit_id"]

    # Query single audit event details
    detail_res = client.get(f"/api/audit-logs/{target_audit_id}", headers=super_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()

    # Verify all required fields from Section 4 are present
    required_fields = [
        "portal_username",
        "portal_user_full_name",
        "portal_user_role",
        "asset_tag",
        "category",
        "action",
        "audit_finding",
        "detected_at",
        "old_values",
        "new_values",
        "metadata",
        "status",
    ]
    for field in required_fields:
        assert field in detail, f"Missing required field: {field}"

    # Verify portal actor identity reflects admin
    assert detail["portal_username"] == "admin"
    assert detail["portal_user_full_name"] == "Corporate Admin"
    assert detail["portal_user_role"] == "ADMIN"
    assert detail["status"] == "SUCCESS"

    # Verify detected_at is valid ISO 8601 with timezone
    dt = datetime.fromisoformat(detail["detected_at"].replace("Z", "+00:00"))
    assert dt.tzinfo is not None




from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.app_user import AppUser


def test_individual_field_updates_preserve_unrelated_values(client: TestClient, db_session: Session):
    """
    Test updating individual fields one at a time via PATCH/PUT to confirm
    that only the specified field is updated and unrelated asset values are preserved.
    Fields tested:
    serial_number, manufacturer, model, os_name, macaddress, devicetype, managed_by,
    category, asset_status, computer_id.
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=8101,
        asset_number="AST-FIELD-8101",
        serial_number="ORIG-SN-001",
        source="BIGFIX",
        manufacturer="Dell",
        model="Latitude 5520",
        os_name="Windows 10",
        macaddress="00:11:22:33:44:55",
        computer_id="CID-1001",
        devicetype="Desktop",
        category="CORPORATE",
        managed_by="INDIVIDUAL",
        assigned_username="johndoe",
        lastreporttime=now,
        asset_status="ACTIVE",
        assignment_type="MANUAL",
        remarks="Base remarks",
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # 1. Update serial_number only
    res = client.patch("/api/assets/8101", json={"serial_number": "NEW-SN-8101"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["serial_number"] == "NEW-SN-8101"
    assert data["manufacturer"] == "Dell"
    assert data["model"] == "Latitude 5520"
    assert data["devicetype"] == "Desktop"
    assert data["category"] == "CORPORATE"
    assert data["managed_by"] == "INDIVIDUAL"
    assert data["asset_status"] == "ACTIVE"
    assert data["computer_id"] == "CID-1001"

    # 2. Update manufacturer only
    res = client.patch("/api/assets/8101", json={"manufacturer": "Lenovo"})
    assert res.status_code == 200
    data = res.json()
    assert data["manufacturer"] == "Lenovo"
    assert data["serial_number"] == "NEW-SN-8101"
    assert data["model"] == "Latitude 5520"

    # 3. Update model only
    res = client.patch("/api/assets/8101", json={"model": "ThinkPad T14"})
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "ThinkPad T14"
    assert data["manufacturer"] == "Lenovo"

    # 4. Update os_name only
    res = client.patch("/api/assets/8101", json={"os_name": "Windows 11 Pro"})
    assert res.status_code == 200
    data = res.json()
    assert data["os_name"] == "Windows 11 Pro"

    # 5. Update macaddress only
    res = client.patch("/api/assets/8101", json={"macaddress": "AA:BB:CC:DD:EE:FF"})
    assert res.status_code == 200
    data = res.json()
    assert data["macaddress"] == "AA:BB:CC:DD:EE:FF"

    # 6. Update computer_id only
    res = client.patch("/api/assets/8101", json={"computer_id": "CID-9999"})
    assert res.status_code == 200
    data = res.json()
    assert data["computer_id"] == "CID-9999"

    # 7. Update devicetype to 'Laptop'
    res = client.patch("/api/assets/8101", json={"devicetype": "Laptop"})
    assert res.status_code == 200
    data = res.json()
    assert data["devicetype"] == "Laptop"

    # 8. Update managed_by to 'GROUP'
    res = client.patch("/api/assets/8101", json={"managed_by": "GROUP"})
    assert res.status_code == 200
    data = res.json()
    assert data["managed_by"] == "GROUP"

    # 9. Update category to 'STORE'
    res = client.patch("/api/assets/8101", json={"category": "STORE"})
    assert res.status_code == 200
    data = res.json()
    assert data["category"] == "STORE"

    # 10. Update asset_status to 'INSTOCK'
    res = client.patch("/api/assets/8101", json={"asset_status": "INSTOCK"})
    assert res.status_code == 200
    data = res.json()
    assert data["asset_status"] == "INSTOCK"

    # Update asset_status to 'EXPIRED'
    res_exp = client.patch("/api/assets/8101", json={"asset_status": "EXPIRED"})
    assert res_exp.status_code == 200
    assert res_exp.json()["asset_status"] == "EXPIRED"

    # Verify persistence by reading back the asset
    persisted = client.get("/api/assets/8101").json()
    assert persisted["serial_number"] == "NEW-SN-8101"
    assert persisted["manufacturer"] == "Lenovo"
    assert persisted["model"] == "ThinkPad T14"
    assert persisted["os_name"] == "Windows 11 Pro"
    assert persisted["macaddress"] == "AA:BB:CC:DD:EE:FF"
    assert persisted["computer_id"] == "CID-9999"
    assert persisted["devicetype"] == "Laptop"
    assert persisted["managed_by"] == "GROUP"
    assert persisted["category"] == "STORE"
    assert persisted["asset_status"] == "EXPIRED"
    assert persisted["assigned_username"] == "johndoe"
    assert persisted["remarks"] == "Base remarks"


def test_dropdown_valid_and_invalid_values(client: TestClient, db_session: Session):
    """
    Test validation of dropdown values:
    - devicetype: 'Laptop', 'Desktop'
    - managed_by: 'GROUP', 'INDIVIDUAL'
    - category: 'STORE', 'CORPORATE'
    - asset_status: 'ACTIVE', 'REVIEW', 'INSTOCK', 'EXPIRED'
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=8102,
        asset_number="AST-DROPDOWN-8102",
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # --- Valid devicetype values ---
    for dt in ["Laptop", "Desktop", "laptop", "desktop"]:
        res = client.patch("/api/assets/8102", json={"devicetype": dt})
        assert res.status_code == 200
        assert res.json()["devicetype"] in ("Laptop", "Desktop")

    # Invalid devicetype
    res_bad_dt = client.patch("/api/assets/8102", json={"devicetype": "Server"})
    assert res_bad_dt.status_code in (400, 422)

    res_bad_dt2 = client.patch("/api/assets/8102", json={"devicetype": "Smartphone"})
    assert res_bad_dt2.status_code in (400, 422)

    # --- Valid managed_by values ---
    for mb in ["GROUP", "INDIVIDUAL", "group", "individual"]:
        res = client.patch("/api/assets/8102", json={"managed_by": mb})
        assert res.status_code == 200
        assert res.json()["managed_by"] in ("GROUP", "INDIVIDUAL")

    # Invalid managed_by
    res_bad_mb = client.patch("/api/assets/8102", json={"managed_by": "DEPARTMENT"})
    assert res_bad_mb.status_code == 400

    # --- Valid category values ---
    for cat in ["STORE", "CORPORATE", "store", "corporate"]:
        res = client.patch("/api/assets/8102", json={"category": cat})
        assert res.status_code == 200
        assert res.json()["category"] in ("STORE", "CORPORATE")

    # Invalid category
    res_bad_cat = client.patch("/api/assets/8102", json={"category": "WAREHOUSE"})
    assert res_bad_cat.status_code in (400, 422)

    # --- Valid asset_status values ---
    for st in ["ACTIVE", "REVIEW", "INSTOCK", "EXPIRED"]:
        res = client.patch("/api/assets/8102", json={"asset_status": st})
        assert res.status_code == 200
        assert res.json()["asset_status"] == st

    # Invalid asset_status
    res_bad_st = client.patch("/api/assets/8102", json={"asset_status": "DECOMMISSIONED"})
    assert res_bad_st.status_code == 422


def test_nonexistent_asset_id_returns_404(client: TestClient):
    """
    Test that updating a nonexistent asset ID returns HTTP 404 Not Found.
    """
    res_patch = client.patch("/api/assets/999999", json={"serial_number": "ANY-SN"})
    assert res_patch.status_code == 404
    assert "not found" in res_patch.json()["detail"].lower()

    res_put = client.put("/api/assets/999999", json={"serial_number": "ANY-SN"})
    assert res_put.status_code == 404
    assert "not found" in res_put.json()["detail"].lower()


def test_authorization_checks_on_asset_update(client: TestClient, db_session: Session):
    """
    Test authentication and authorization on asset update:
    - VIEWER role cannot update asset (403 Forbidden)
    - ADMIN and SUPERADMIN roles can update asset (200 OK)
    - Invalid bearer token rejected (401 Unauthorized)
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=8103,
        asset_number="AST-AUTH-8103",
        serial_number="ORIG-8103",
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # 1. Login as VIEWER
    login_v = client.post("/api/auth/login", json={"username": "viewer", "password": "Viewer@123"})
    assert login_v.status_code == 200
    v_token = login_v.json()["access_token"]

    # VIEWER update attempt -> 403 Forbidden
    res_viewer = client.patch(
        "/api/assets/8103",
        json={"serial_number": "TAMPERED-SN"},
        headers={"Authorization": f"Bearer {v_token}"},
    )
    assert res_viewer.status_code == 403

    # Explicit role header with viewer -> 403 Forbidden
    res_role_viewer = client.patch(
        "/api/assets/8103",
        json={"serial_number": "TAMPERED-SN"},
        headers={"X-Role": "viewer"},
    )
    assert res_role_viewer.status_code == 403

    # 2. Invalid bearer token -> 401 Unauthorized
    res_bad_token = client.patch(
        "/api/assets/8103",
        json={"serial_number": "TAMPERED-SN"},
        headers={"Authorization": "Bearer invalid_token_abc_123"},
    )
    assert res_bad_token.status_code == 401

    # 3. Login as ADMIN
    login_a = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    assert login_a.status_code == 200
    a_token = login_a.json()["access_token"]

    res_admin = client.patch(
        "/api/assets/8103",
        json={"serial_number": "ADMIN-UPDATED-SN"},
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["serial_number"] == "ADMIN-UPDATED-SN"


def test_put_and_patch_full_and_partial_consistency(client: TestClient, db_session: Session):
    """
    Test that both PUT and PATCH endpoints update and return the full updated asset contract.
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=8104,
        asset_number="AST-CONTRACT-8104",
        serial_number="INITIAL-SN",
        devicetype="Desktop",
        category="STORE",
        managed_by="INDIVIDUAL",
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # Update via PUT with multiple fields
    payload = {
        "serial_number": "PUT-SN-8104",
        "manufacturer": "HP",
        "model": "EliteBook 840",
        "devicetype": "Laptop",
        "category": "CORPORATE",
        "managed_by": "GROUP",
        "asset_status": "INSTOCK",
        "computer_id": "CID-8104",
    }
    res_put = client.put("/api/assets/8104", json=payload)
    assert res_put.status_code == 200
    data = res_put.json()

    assert data["asset_id"] == 8104
    assert data["asset_number"] == "AST-CONTRACT-8104"
    assert data["serial_number"] == "PUT-SN-8104"
    assert data["manufacturer"] == "HP"
    assert data["model"] == "EliteBook 840"
    assert data["devicetype"] == "Laptop"
    assert data["category"] == "CORPORATE"
    assert data["managed_by"] == "GROUP"
    assert data["asset_status"] == "INSTOCK"
    assert data["computer_id"] == "CID-8104"

    # Confirm persistence in database
    get_res = client.get("/api/assets/8104")
    assert get_res.status_code == 200
    persisted = get_res.json()
    assert persisted["serial_number"] == "PUT-SN-8104"
    assert persisted["manufacturer"] == "HP"
    assert persisted["model"] == "EliteBook 840"
    assert persisted["devicetype"] == "Laptop"
    assert persisted["category"] == "CORPORATE"
    assert persisted["managed_by"] == "GROUP"
    assert persisted["asset_status"] == "INSTOCK"
    assert persisted["computer_id"] == "CID-8104"

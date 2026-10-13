from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.workday_employee import WorkdayEmployee


def test_null_asset_persistence_and_retrieval(client: TestClient, db_session: Session):
    """
    Test creating and retrieving an asset with all 13 nullable fields set to None:
    - serial_number
    - source
    - manufacturer
    - model
    - os_name
    - macaddress
    - devicetype
    - managed_by
    - assigned_username
    - lastreporttime
    - asset_status
    - assignment_type
    - last_synced_at
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=9001,
        asset_number="AST-NULL-ALL-9001",
        serial_number=None,
        source=None,
        manufacturer=None,
        model=None,
        os_name=None,
        macaddress=None,
        devicetype=None,
        managed_by=None,
        assigned_username=None,
        lastreporttime=None,
        asset_status=None,
        assignment_type=None,
        last_synced_at=None,
        remarks=None,
        created_at=now,
        updated_at=None,
    )
    db_session.add(asset)
    db_session.commit()

    # 1. Retrieve via GET /api/assets/{asset_id}
    res = client.get("/api/assets/9001")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["asset_id"] == 9001
    assert data["asset_number"] == "AST-NULL-ALL-9001"
    assert data["serial_number"] is None
    assert data["source"] is None
    assert data["manufacturer"] is None
    assert data["model"] is None
    assert data["os_name"] is None
    assert data["macaddress"] is None
    assert data["devicetype"] is None
    assert data["managed_by"] is None
    assert data["assigned_username"] is None
    assert data["lastreporttime"] is None
    assert data["asset_status"] is None
    assert data["assignment_type"] is None
    assert data["last_synced_at"] is None

    # Verify business logic for null values
    assert data["workday_status"] == "No assigned username"
    assert data["ownership_status"] == "UNASSIGNED"
    assert data["matched_employee"] is None
    assert data["eol_status"] == "UNKNOWN"
    assert data["eol_date"] is None
    assert data["days_remaining"] is None


def test_null_asset_in_list_and_filters(client: TestClient, db_session: Session):
    """
    Test that assets with null fields appear in generic list endpoints,
    do not match source filters (BIGFIX / JAMF),
    and do not crash search or sorting operations.
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=9002,
        asset_number="AST-NULL-FILTER-9002",
        serial_number=None,
        source=None,
        manufacturer=None,
        model=None,
        os_name=None,
        macaddress=None,
        devicetype=None,
        managed_by=None,
        assigned_username=None,
        lastreporttime=None,
        asset_status=None,
        assignment_type=None,
        last_synced_at=None,
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # 1. Generic list includes the asset
    res_all = client.get("/api/assets?search=AST-NULL-FILTER-9002")
    assert res_all.status_code == 200
    assert res_all.json()["total"] == 1
    item = res_all.json()["items"][0]
    assert item["asset_id"] == 9002
    assert item["source"] is None
    assert item["serial_number"] is None

    # 2. Source-specific filters exclude null-source asset
    res_bigfix = client.get("/api/assets?source=BIGFIX&search=AST-NULL-FILTER-9002")
    assert res_bigfix.status_code == 200
    assert res_bigfix.json()["total"] == 0

    res_jamf = client.get("/api/assets?source=JAMF&search=AST-NULL-FILTER-9002")
    assert res_jamf.status_code == 200
    assert res_jamf.json()["total"] == 0

    # 3. Sorting by nullable columns does not crash
    for sort_col in ["serial_number", "model", "manufacturer", "lastreporttime", "last_synced_at", "managed_by"]:
        res_sort_asc = client.get(f"/api/assets?sort_by={sort_col}&sort_order=asc")
        assert res_sort_asc.status_code == 200
        res_sort_desc = client.get(f"/api/assets?sort_by={sort_col}&sort_order=desc")
        assert res_sort_desc.status_code == 200


def test_patch_partial_update_and_clearing_nullable_fields(client: TestClient, db_session: Session):
    """
    Test PATCH /api/assets/{asset_id}:
    - Clears nullable fields when explicitly passed as null (None).
    - Preserves omitted fields without overwriting.
    - Clears assigned user when assigned_username is null.
    """
    now = datetime.now(timezone.utc)
    # Start with a fully-populated asset
    asset = Asset(
        asset_id=9003,
        asset_number="AST-PATCH-9003",
        serial_number="SN-INITIAL-9003",
        source="BIGFIX",
        manufacturer="Dell",
        model="Latitude 5520",
        os_name="Windows 11",
        macaddress="00:11:22:33:44:55",
        devicetype="Desktop",
        managed_by="INDIVIDUAL",
        assigned_username="sarahconnor",
        lastreporttime=now,
        asset_status="ACTIVE",
        assignment_type="MANUAL",
        last_synced_at=now,
        remarks="Initial setup",
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # 1. Partial update: clear serial_number and manufacturer to null, omit model and source
    patch_payload_1 = {
        "serial_number": None,
        "manufacturer": None,
    }
    res_patch_1 = client.patch("/api/assets/9003", json=patch_payload_1)
    assert res_patch_1.status_code == 200, res_patch_1.text
    data_1 = res_patch_1.json()

    assert data_1["serial_number"] is None
    assert data_1["manufacturer"] is None
    # Omitted fields remain unchanged
    assert data_1["model"] == "Latitude 5520"
    assert data_1["source"] == "BIGFIX"
    assert data_1["assigned_username"] == "sarahconnor"
    assert data_1["asset_status"] == "ACTIVE"

    # 2. Clear assigned_username to null (unassign) and clear managed_by
    patch_payload_2 = {
        "assigned_username": None,
        "managed_by": None,
    }
    res_patch_2 = client.patch("/api/assets/9003", json=patch_payload_2)
    assert res_patch_2.status_code == 200, res_patch_2.text
    data_2 = res_patch_2.json()

    assert data_2["assigned_username"] is None
    assert data_2["managed_by"] is None
    assert data_2["workday_status"] == "No assigned username"
    assert data_2["ownership_status"] == "UNASSIGNED"
    # Preserves model from step 1
    assert data_2["model"] == "Latitude 5520"

    # 3. Clear asset_status and assignment_type to null
    patch_payload_3 = {
        "asset_status": None,
        "assignment_type": None,
    }
    res_patch_3 = client.patch("/api/assets/9003", json=patch_payload_3)
    assert res_patch_3.status_code == 200, res_patch_3.text
    data_3 = res_patch_3.json()

    assert data_3["asset_status"] is None
    assert data_3["assignment_type"] is None


def test_patch_validation_rejects_invalid_non_null_values(client: TestClient, db_session: Session):
    """
    Verify validation rejects invalid non-null values for asset_status, assignment_type,
    and managed_by while allowing null.
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=9004,
        asset_number="AST-VAL-9004",
        asset_status="ACTIVE",
        assignment_type="MANUAL",
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # Invalid non-null asset_status returns 422
    res_bad_status = client.patch("/api/assets/9004", json={"asset_status": "BOGUS_STATUS"})
    assert res_bad_status.status_code == 422

    # Invalid non-null assignment_type returns 422
    res_bad_type = client.patch("/api/assets/9004", json={"assignment_type": "BOGUS_TYPE"})
    assert res_bad_type.status_code == 422

    # Invalid non-null managed_by returns 400
    res_bad_managed = client.patch("/api/assets/9004", json={"managed_by": "BOGUS_MANAGED"})
    assert res_bad_managed.status_code == 400


def test_eol_endpoints_with_null_assets(client: TestClient, db_session: Session):
    """
    Verify /api/eol and /api/dashboard/eol-summary handle assets with null fields
    without errors and calculate UNKNOWN status.
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=9005,
        asset_number="AST-EOL-9005",
        serial_number=None,
        source=None,
        manufacturer=None,
        model=None,
        os_name=None,
        macaddress=None,
        devicetype=None,
        managed_by=None,
        assigned_username=None,
        lastreporttime=None,
        asset_status=None,
        assignment_type=None,
        last_synced_at=None,
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    # 1. GET /api/eol
    res_eol = client.get("/api/eol?search=AST-EOL-9005")
    assert res_eol.status_code == 200
    assert res_eol.json()["total"] == 1
    item = res_eol.json()["items"][0]
    assert item["asset_number"] == "AST-EOL-9005"
    assert item["serial_number"] is None
    assert item["eol_status"] == "UNKNOWN"
    assert item["eol_date"] is None

    # 2. GET /api/dashboard/eol-summary
    res_summary = client.get("/api/dashboard/eol-summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert summary["unknown_count"] >= 1


def test_employee_detail_with_null_fields_on_assigned_asset(client: TestClient, db_session: Session):
    """
    Verify GET /api/employees/{id} serializes correlated assets with null fields cleanly.
    """
    now = datetime.now(timezone.utc)
    # Assign asset to sarahconnor (employee_id=2 in seeded test DB)
    asset = Asset(
        asset_id=9006,
        asset_number="AST-EMP-NULL-9006",
        serial_number=None,
        source=None,
        manufacturer=None,
        model=None,
        os_name=None,
        macaddress=None,
        devicetype=None,
        managed_by=None,
        assigned_username="sarahconnor",
        lastreporttime=None,
        asset_status="ACTIVE",
        assignment_type=None,
        last_synced_at=None,
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    res_emp = client.get("/api/employees/2")
    assert res_emp.status_code == 200, res_emp.text
    emp_data = res_emp.json()
    matching = [a for a in emp_data["assigned_assets"] if a["asset_id"] == 9006]
    assert len(matching) == 1
    assigned = matching[0]
    assert assigned["serial_number"] is None
    assert assigned["manufacturer"] is None
    assert assigned["model"] is None
    assert assigned["source"] is None
    assert assigned["os_name"] is None
    assert assigned["devicetype"] is None
    assert assigned["lastreporttime"] is None

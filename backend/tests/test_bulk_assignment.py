import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.asset import Asset


def test_bulk_assign_success(client: TestClient):
    """
    Verify bulk assignment of multiple assets to an active Workday employee.
    - Sets assigned_username to target employee
    - Sets managed_by to 'GROUP'
    - Sets assignment_type to 'MANUAL'
    - Sets asset_status to 'ACTIVE'
    - Sets remarks
    - Returns aggregate success_count and per-asset results
    """
    payload = {
        "asset_ids": [3, 4],
        "assigned_username": "sarahconnor",
        "managed_by": "GROUP",
        "remarks": "Bulk assigned for incident response team",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["requested_count"] == 2
    assert data["success_count"] == 2
    assert data["failure_count"] == 0
    assert len(data["results"]) == 2

    for res in data["results"]:
        assert res["status"] == "SUCCESS"
        assert res["asset_id"] in [3, 4]
        assert res["reason"] is None

    # Verify database persistence for asset 3
    get_3 = client.get("/api/assets/3").json()
    assert get_3["assigned_username"] == "sarahconnor"
    assert get_3["managed_by"] == "GROUP"
    assert get_3["assignment_type"] == "MANUAL"
    assert get_3["asset_status"] == "ACTIVE"
    assert get_3["remarks"] == "Bulk assigned for incident response team"

    # Verify database persistence for asset 4
    get_4 = client.get("/api/assets/4").json()
    assert get_4["assigned_username"] == "sarahconnor"
    assert get_4["managed_by"] == "GROUP"
    assert get_4["assignment_type"] == "MANUAL"
    assert get_4["asset_status"] == "ACTIVE"
    assert get_4["remarks"] == "Bulk assigned for incident response team"


def test_bulk_assign_preserves_existing_remarks_when_omitted(client: TestClient):
    """
    Verify that existing remarks on assets are preserved when remarks is omitted
    in the bulk assignment request.
    """
    # Asset 1 initially has remarks="Primary developer laptop"
    # Asset 2 initially has remarks="Needs security check"
    payload = {
        "asset_ids": [1, 2],
        "assigned_username": "sarahconnor",
        "managed_by": "INDIVIDUAL",
        # remarks omitted
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["success_count"] == 2

    # Verify remarks were preserved
    asset_1 = client.get("/api/assets/1").json()
    assert asset_1["assigned_username"] == "sarahconnor"
    assert asset_1["remarks"] == "Primary developer laptop"

    asset_2 = client.get("/api/assets/2").json()
    assert asset_2["assigned_username"] == "sarahconnor"
    assert asset_2["remarks"] == "Needs security check"


def test_bulk_assign_partial_failure_with_savepoints(client: TestClient):
    """
    Verify that when some asset IDs exist and some do not,
    existing assets are successfully assigned, non-existent assets are marked FAILED,
    and partial results are reported accurately.
    """
    payload = {
        "asset_ids": [1, 999999, 2],
        "assigned_username": "johndoe",
        "managed_by": "INDIVIDUAL",
        "remarks": "Partial batch test",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["requested_count"] == 3
    assert data["success_count"] == 2
    assert data["failure_count"] == 1

    results_by_id = {r["asset_id"]: r for r in data["results"]}
    assert results_by_id[1]["status"] == "SUCCESS"
    assert results_by_id[2]["status"] == "SUCCESS"
    assert results_by_id[999999]["status"] == "FAILED"
    assert "not found" in results_by_id[999999]["reason"].lower()

    # Verify assets 1 and 2 were assigned
    assert client.get("/api/assets/1").json()["assigned_username"] == "johndoe"
    assert client.get("/api/assets/2").json()["assigned_username"] == "johndoe"


def test_bulk_assign_all_failed(client: TestClient):
    """
    Verify response when none of the requested asset IDs exist.
    """
    payload = {
        "asset_ids": [88888, 99999],
        "assigned_username": "johndoe",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["requested_count"] == 2
    assert data["success_count"] == 0
    assert data["failure_count"] == 2
    assert "failed for all" in data["message"].lower()


def test_bulk_assign_rejects_empty_asset_ids(client: TestClient):
    """
    Verify bulk assignment rejects empty asset_ids array with HTTP 400.
    """
    payload = {
        "asset_ids": [],
        "assigned_username": "johndoe",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 400
    assert "at least one" in response.json()["detail"].lower()


def test_bulk_assign_rejects_duplicate_asset_ids(client: TestClient):
    """
    Verify bulk assignment rejects duplicate asset IDs with HTTP 400.
    """
    payload = {
        "asset_ids": [1, 2, 1],
        "assigned_username": "johndoe",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 400
    assert "duplicate" in response.json()["detail"].lower()


def test_bulk_assign_rejects_invalid_asset_ids(client: TestClient):
    """
    Verify bulk assignment rejects negative or zero asset IDs with HTTP 400.
    """
    payload = {
        "asset_ids": [1, -5],
        "assigned_username": "johndoe",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 400
    assert "positive integer" in response.json()["detail"].lower()


def test_bulk_assign_rejects_nonexistent_employee(client: TestClient):
    """
    Verify bulk assignment rejects non-existent Workday employee with HTTP 400.
    """
    payload = {
        "asset_ids": [1, 2],
        "assigned_username": "ghost_user_404",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_bulk_assign_rejects_inactive_employee(client: TestClient):
    """
    Verify bulk assignment rejects inactive/terminated Workday employee with HTTP 400.
    """
    payload = {
        "asset_ids": [1, 2],
        "assigned_username": "alexturner",  # Inactive (Terminated) employee in conftest
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 400
    assert "cannot be assigned" in response.json()["detail"].lower()


def test_bulk_assign_rejects_invalid_managed_by(client: TestClient):
    """
    Verify managed_by validation rejects values other than 'INDIVIDUAL' or 'GROUP'.
    """
    payload = {
        "asset_ids": [1, 2],
        "assigned_username": "johndoe",
        "managed_by": "INVALID_SCOPE",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 400
    assert "INDIVIDUAL" in response.json()["detail"]


def test_bulk_assign_defaults_managed_by_to_individual(client: TestClient):
    """
    Verify that if managed_by is omitted, it defaults to 'INDIVIDUAL'.
    """
    payload = {
        "asset_ids": [3],
        "assigned_username": "johndoe",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200
    assert response.json()["success_count"] == 1

    asset_3 = client.get("/api/assets/3").json()
    assert asset_3["managed_by"] == "INDIVIDUAL"


def test_bulk_assign_admin_authorization(client: TestClient):
    """
    Verify admin authorization enforcement:
    - Viewer role is rejected with HTTP 403 Forbidden
    - Non-admin user ID is rejected with HTTP 403 Forbidden
    - Verified admin user (johndoe) succeeds
    """
    payload = {
        "asset_ids": [3],
        "assigned_username": "sarahconnor",
        "managed_by": "INDIVIDUAL",
    }

    # 1. Viewer role header -> 403
    res_viewer = client.post(
        "/api/assets/bulk-assign",
        json=payload,
        headers={"X-Role": "viewer"},
    )
    assert res_viewer.status_code == 403

    # 2. Non-admin user ID -> 403 (sarahconnor is an employee but not in admin_users table)
    res_nonadmin = client.post(
        "/api/assets/bulk-assign",
        json=payload,
        headers={"X-User-Id": "sarahconnor"},
    )
    assert res_nonadmin.status_code == 403

    # 3. Verified admin user ID -> 200 (johndoe is in admin_users table)
    res_admin = client.post(
        "/api/assets/bulk-assign",
        json=payload,
        headers={"X-User-Id": "johndoe"},
    )
    assert res_admin.status_code == 200


def test_bulk_assign_put_and_alternate_endpoints(client: TestClient):
    """
    Verify PUT method and alias paths /api/assets/bulk-assignment work.
    """
    payload = {
        "asset_ids": [3],
        "assigned_username": "johndoe",
        "managed_by": "GROUP",
    }

    # PUT /api/assets/bulk-assign
    put_res = client.put("/api/assets/bulk-assign", json=payload)
    assert put_res.status_code == 200
    assert put_res.json()["success_count"] == 1

    # POST /api/assets/bulk-assignment
    post_alias = client.post("/api/assets/bulk-assignment", json=payload)
    assert post_alias.status_code == 200
    assert post_alias.json()["success_count"] == 1

    # PUT /api/assets/bulk-assignment
    put_alias = client.put("/api/assets/bulk-assignment", json=payload)
    assert put_alias.status_code == 200
    assert put_alias.json()["success_count"] == 1

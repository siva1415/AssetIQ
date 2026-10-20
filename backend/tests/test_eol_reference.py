from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.device_eol_reference import DeviceEolReference


def test_list_eol_references(client: TestClient):
    """
    Test GET /api/eol-reference endpoint returns live list of EOL records.
    """
    response = client.get("/api/eol-reference")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 3
    assert data[0]["manufacturer"] is not None
    assert data[0]["model"] is not None
    assert data[0]["eol_date"] is not None
    assert "reference_source" in data[0]


def test_list_eol_references_paginated(client: TestClient):
    """
    Test GET /api/eol-reference?paginated=true returns paginated envelope.
    """
    response = client.get("/api/eol-reference?paginated=true")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    assert data["items"][0]["manufacturer"] is not None
    assert data["items"][0]["model"] is not None


def test_list_eol_references_empty(client: TestClient, db_session: Session):
    """
    Verify empty EOL records table returns HTTP 200 and empty list [], not 404.
    """
    db_session.query(DeviceEolReference).delete()
    db_session.commit()

    response = client.get("/api/eol-reference")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert data == []


def test_get_eol_reference_by_id(client: TestClient):
    """
    Test GET /api/eol-reference/{eol_id} endpoint.
    """
    response = client.get("/api/eol-reference/1")
    assert response.status_code == 200
    data = response.json()
    assert data["eol_id"] == 1
    assert data["manufacturer"] == "Apple"

    not_found = client.get("/api/eol-reference/9999")
    assert not_found.status_code == 404


def test_create_eol_reference(client: TestClient):
    """
    Test POST /api/eol-reference endpoint.
    """
    payload = {
        "manufacturer": "Microsoft",
        "model": "Surface Laptop 5",
        "eol_date": "2028-10-31",
        "reference_source": "Microsoft Surface Support Lifecycle",
    }
    response = client.post("/api/eol-reference", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["manufacturer"] == "Microsoft"
    assert data["model"] == "Surface Laptop 5"
    assert data["eol_date"] == "2028-10-31"


def test_update_eol_reference(client: TestClient):
    """
    Test PUT /api/eol-reference/{eol_id} endpoint.
    """
    payload = {
        "eol_date": "2029-01-01",
        "reference_source": "Updated Lifecycle Matrix",
    }
    response = client.put("/api/eol-reference/1", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["eol_id"] == 1
    assert data["eol_date"] == "2029-01-01"
    assert data["reference_source"] == "Updated Lifecycle Matrix"


def test_delete_eol_reference(client: TestClient):
    """
    Test DELETE /api/eol-reference/{eol_id} endpoint.
    """
    response = client.delete("/api/eol-reference/2")
    assert response.status_code == 200

    # Verify subsequent lookup is 404
    get_res = client.delete("/api/eol-reference/2")
    assert get_res.status_code == 404


def test_create_or_update_existing_record_preserves_source_and_no_duplicates(client: TestClient):
    """
    Verify inline EOL update for existing manufacturer and model:
    - Updates existing record's eol_date without creating duplicate
    - Preserves existing reference_source when omitted in payload
    - Asserts 'referenceSource' is NOT in canonical response
    - Asserts Asset Ownership API reflects the updated EOL date and calculated status
    """
    # Apple MacBook Pro 16 exists with eol_id=1, initial status EXPIRED
    initial_assets = client.get("/api/assets/1").json()
    assert initial_assets["manufacturer"] == "Apple"
    assert initial_assets["model"] == "MacBook Pro 16"
    assert initial_assets["eol_status"] == "EXPIRED"

    initial_refs = client.get("/api/eol-reference").json()
    initial_ref_count = len(initial_refs)

    # Perform inline update via POST /api/eol-reference with future date and omitted reference_source
    payload = {
        "manufacturer": "Apple",
        "model": "MacBook Pro 16",
        "eol_date": "2032-12-31",
    }
    response = client.post("/api/eol-reference", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["eol_id"] == 1
    assert data["manufacturer"] == "Apple"
    assert data["model"] == "MacBook Pro 16"
    assert data["eol_date"] == "2032-12-31"
    # Preserves existing reference_source
    assert data["reference_source"] == "Apple Hardware Lifecycle Matrix"
    # Ensures duplicate referenceSource field is NOT present
    assert "referenceSource" not in data

    # Verify no duplicate reference records created
    updated_refs = client.get("/api/eol-reference").json()
    assert len(updated_refs) == initial_ref_count

    # Verify Asset Ownership API dynamically reflects the updated EOL date and status
    asset_after = client.get("/api/assets/1").json()
    assert asset_after["eol_date"] == "2032-12-31"
    assert asset_after["eol_status"] == "ACTIVE"
    assert asset_after["days_remaining"] > 365
    assert asset_after["reference_source"] == "Apple Hardware Lifecycle Matrix"
    assert "referenceSource" not in asset_after


def test_put_upsert_endpoint(client: TestClient):
    """
    Verify PUT /api/eol-reference endpoint supports create-or-update.
    """
    # 1. Update existing Dell PowerEdge R750 (eol_id=3)
    put_payload = {
        "manufacturer": "Dell",
        "model": "PowerEdge R750",
        "eol_date": "2035-01-01",
        "reference_source": "Dell Global Lifecycle Bulletin",
    }
    response = client.put("/api/eol-reference", json=put_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["eol_id"] == 3
    assert data["eol_date"] == "2035-01-01"
    assert data["reference_source"] == "Dell Global Lifecycle Bulletin"
    assert "referenceSource" not in data

    # Verify asset 3 reflects updated EOL info
    asset_3 = client.get("/api/assets/3").json()
    assert asset_3["eol_date"] == "2035-01-01"
    assert asset_3["eol_status"] == "ACTIVE"


def test_reference_source_standardization_and_compatibility(client: TestClient):
    """
    Verify that incoming legacy referenceSource is accepted for backward compatibility,
    canonical field is reference_source, and referenceSource is never emitted in responses.
    """
    payload = {
        "manufacturer": "Lenovo",
        "model": "ThinkPad P16",
        "eol_date": "2029-06-30",
        "referenceSource": "Lenovo PSREF Matrix",
    }
    response = client.post("/api/eol-reference", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["manufacturer"] == "Lenovo"
    assert data["model"] == "ThinkPad P16"
    assert data["reference_source"] == "Lenovo PSREF Matrix"
    assert "referenceSource" not in data

    # Verify GET /api/eol-reference responses never contain referenceSource
    get_res = client.get("/api/eol-reference")
    assert get_res.status_code == 200
    all_refs = get_res.json()
    for ref in all_refs:
        assert "reference_source" in ref
        assert "referenceSource" not in ref


def test_eol_reference_admin_authorization(client: TestClient):
    """
    Verify admin authorization enforcement on EOL reference mutation endpoints:
    - Viewer role is rejected with HTTP 403 Forbidden
    - Non-admin user is rejected with HTTP 403 Forbidden
    - Verified admin user succeeds
    """
    payload = {
        "manufacturer": "Apple",
        "model": "MacBook Pro 16",
        "eol_date": "2031-01-01",
    }

    # Viewer role header rejected
    res_viewer = client.post("/api/eol-reference", json=payload, headers={"X-Role": "viewer"})
    assert res_viewer.status_code == 403

    # Non-admin user rejected (sarahconnor is employee, not in admin_users)
    res_nonadmin = client.post("/api/eol-reference", json=payload, headers={"X-User-Id": "sarahconnor"})
    assert res_nonadmin.status_code == 403

    # PUT by ID rejected for viewer
    res_put_viewer = client.put("/api/eol-reference/1", json={"eol_date": "2031-01-01"}, headers={"X-Role": "viewer"})
    assert res_put_viewer.status_code == 403

    # DELETE rejected for viewer
    res_del_viewer = client.delete("/api/eol-reference/1", headers={"X-Role": "viewer"})
    assert res_del_viewer.status_code == 403

    # Verified admin user succeeds
    res_admin = client.post("/api/eol-reference", json=payload, headers={"X-User-Id": "johndoe"})
    assert res_admin.status_code == 200


def test_eol_reference_validation_errors(client: TestClient):
    """
    Verify invalid inputs return HTTP 422:
    - Empty manufacturer
    - Empty model
    - Invalid date format
    """
    # Empty manufacturer
    res_empty_mfg = client.post(
        "/api/eol-reference",
        json={"manufacturer": "", "model": "ThinkPad", "eol_date": "2028-10-31"},
    )
    assert res_empty_mfg.status_code == 422

    # Empty model
    res_empty_mdl = client.post(
        "/api/eol-reference",
        json={"manufacturer": "Apple", "model": "", "eol_date": "2028-10-31"},
    )
    assert res_empty_mdl.status_code == 422

    # Invalid date
    res_bad_date = client.post(
        "/api/eol-reference",
        json={"manufacturer": "Apple", "model": "MacBook Air", "eol_date": "not-a-valid-date"},
    )
    assert res_bad_date.status_code == 422


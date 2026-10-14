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

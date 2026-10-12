from fastapi.testclient import TestClient


def test_list_employees(client: TestClient):
    """
    Test paginated employee retrieval.
    """
    response = client.get("/api/employees")
    assert response.status_code == 200
    data = response.json()
    assert data["total_items"] == 3
    assert len(data["items"]) == 3


def test_employee_detail_with_correlated_assets(client: TestClient):
    """
    Test retrieving employee detail correlates all assigned assets:
    - John Doe ('johndoe') should have AST-1001 ('  JOHNDOE  ') in assigned_assets list.
    """
    response = client.get("/api/employees/1")
    assert response.status_code == 200
    data = response.json()

    assert data["user_id"] == "johndoe"
    assert data["full_name"] == "John Doe"
    assert data["assigned_assets_count"] == 1
    assert len(data["assigned_assets"]) == 1
    assert data["assigned_assets"][0]["asset_number"] == "AST-1001"


def test_employee_not_found(client: TestClient):
    """
    Verify 404 on missing employee.
    """
    response = client.get("/api/employees/999999")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_filter_options_endpoint(client: TestClient):
    """
    Verify GET /api/filters returns populated dropdown option arrays.
    """
    response = client.get("/api/filters")
    assert response.status_code == 200
    data = response.json()

    assert "BIGFIX" in data["sources"]
    assert "JAMF" in data["sources"]
    assert "Active" in data["asset_statuses"]
    assert "Desktop" in data["device_types"]
    assert "Engineering" in data["departments"]

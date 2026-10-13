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


def test_list_employees_pagination_and_search_robustness(client: TestClient):
    """
    Verify that frontend query patterns (such as page_size > 100, camelCase pageSize,
    and search parameter) succeed without returning HTTP 422.
    """
    # 1. Page size exceeds default max - should cap at MAX_PAGE_SIZE rather than failing with 422
    res_large = client.get("/api/employees?page=1&page_size=500")
    assert res_large.status_code == 200
    assert len(res_large.json()["items"]) <= 100

    # 2. camelCase pageSize alias
    res_camel = client.get("/api/employees?page=1&pageSize=10")
    assert res_camel.status_code == 200

    # 3. Search by employee name
    res_search_name = client.get("/api/employees?search=Sarah")
    assert res_search_name.status_code == 200
    data_name = res_search_name.json()
    assert data_name["total_items"] == 1
    assert data_name["items"][0]["user_id"] == "sarahconnor"

    # 4. Search by user_id
    res_search_uid = client.get("/api/employees?search=johndoe")
    assert res_search_uid.status_code == 200
    assert res_search_uid.json()["items"][0]["full_name"] == "John Doe"

    # 5. Search by work email
    res_search_email = client.get("/api/employees?search=alex.turner@enterprise.com")
    assert res_search_email.status_code == 200
    assert res_search_email.json()["items"][0]["user_id"] == "alexturner"

    # 6. Empty search results return valid pagination structure without 422 or error
    res_empty = client.get("/api/employees?search=nonexistent_person_xyz")
    assert res_empty.status_code == 200
    empty_data = res_empty.json()
    assert empty_data["total_items"] == 0
    assert empty_data["items"] == []
    assert empty_data["page"] == 1
    assert empty_data["total_pages"] == 0


from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_list_admin_users_joined_with_workday(client: TestClient):
    """
    Test GET /api/admin-users joins admin_users.admin_user_id to workday_employees.user_id.
    """
    response = client.get("/api/admin-users")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

    item = data[0]
    assert item["admin_user_id"] == "johndoe"
    assert item["full_name"] == "John Doe"
    assert item["email_work"] == "john.doe@enterprise.com"
    assert item["department"] == "Engineering"
    assert item["job_title"] == "Senior Systems Engineer"


def test_available_users_endpoint_returns_non_admin_workday_employees(client: TestClient):
    """
    Test GET /api/admin-users/available-users returns Workday employees not already in admin_users.
    Verifies required fields: user_id, full_name, email_work, employee_status.
    Verifies that registered admin (johndoe) is excluded.
    """
    response = client.get("/api/admin-users/available-users")
    assert response.status_code == 200
    data = response.json()

    # Pagination metadata
    assert data["total"] == 2
    assert data["total_pages"] == 1
    assert data["page"] == 1
    assert data["page_size"] == 25

    items = data["items"]
    assert len(items) == 2
    user_ids = [item["user_id"] for item in items]
    assert "sarahconnor" in user_ids
    assert "alexturner" in user_ids
    assert "johndoe" not in user_ids

    # Verify required fields
    sarah = next(i for i in items if i["user_id"] == "sarahconnor")
    assert sarah["full_name"] == "Sarah Connor"
    assert sarah["email_work"] == "sarah.connor@enterprise.com"
    assert sarah["employee_status"] == "Active"


def test_available_users_searching_and_filtering(client: TestClient):
    """
    Test searching by user ID, full name, and work email on GET /api/admin-users/available-users.
    """
    # 1. Search by user ID
    res_id = client.get("/api/admin-users/available-users?search=sarah")
    assert res_id.status_code == 200
    items_id = res_id.json()["items"]
    assert len(items_id) == 1
    assert items_id[0]["user_id"] == "sarahconnor"

    # 2. Search by full name
    res_name = client.get("/api/admin-users/available-users?search=Alex")
    assert res_name.status_code == 200
    items_name = res_name.json()["items"]
    assert len(items_name) == 1
    assert items_name[0]["user_id"] == "alexturner"

    # 3. Search by work email domain
    res_email = client.get("/api/admin-users/available-users?search=enterprise.com")
    assert res_email.status_code == 200
    assert res_email.json()["total"] == 2

    # 4. Explicit parameter filtering
    res_param = client.get("/api/admin-users/available-users?user_id=sarahconnor")
    assert res_param.status_code == 200
    assert len(res_param.json()["items"]) == 1


def test_available_users_pagination(client: TestClient):
    """
    Test pagination parameters (page, page_size) and envelopes on GET /api/admin-users/available-users.
    """
    # Page 1, page_size 1
    p1 = client.get("/api/admin-users/available-users?page=1&page_size=1")
    assert p1.status_code == 200
    d1 = p1.json()
    assert len(d1["items"]) == 1
    assert d1["total"] == 2
    assert d1["total_pages"] == 2
    assert d1["page"] == 1
    assert d1["page_size"] == 1

    # Page 2, page_size 1
    p2 = client.get("/api/admin-users/available-users?page=2&page_size=1")
    assert p2.status_code == 200
    d2 = p2.json()
    assert len(d2["items"]) == 1
    assert d2["page"] == 2
    assert d1["items"][0]["user_id"] != d2["items"][0]["user_id"]


def test_available_users_empty_result(client: TestClient):
    """
    Test that searching for a non-existent employee returns an empty result set correctly.
    """
    response = client.get("/api/admin-users/available-users?search=nonexistent_nobody_xyz")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["total_pages"] == 0
    assert data["page"] == 1


def test_bulk_add_admin_users_success_and_summary(client: TestClient):
    """
    Test POST /api/admin-users with `{"user_ids": ["sarahconnor", "alexturner"]}`:
    - Stores user_id in admin_users.admin_user_id
    - Returns summary of inserted, skipped, and invalid IDs
    - Updates listing joined with Workday
    - Removes them from available users
    """
    payload = {"user_ids": ["sarahconnor", "alexturner"]}
    response = client.post("/api/admin-users", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["total_inserted"] == 2
    assert data["total_skipped"] == 0
    assert data["total_invalid"] == 0
    inserted_ids = [u["user_id"] for u in data["inserted"]]
    assert "sarahconnor" in inserted_ids
    assert "alexturner" in inserted_ids

    # Listing now contains all 3 admins
    list_res = client.get("/api/admin-users")
    assert list_res.status_code == 200
    all_admins = [u["admin_user_id"] for u in list_res.json()]
    assert "johndoe" in all_admins
    assert "sarahconnor" in all_admins
    assert "alexturner" in all_admins

    # Available users now empty
    avail_res = client.get("/api/admin-users/available-users")
    assert avail_res.status_code == 200
    assert avail_res.json()["total"] == 0


def test_bulk_add_admin_users_with_duplicates_and_invalid_ids(client: TestClient):
    """
    Test POST /api/admin-users skips already registered admins and marks non-existent Workday IDs as invalid.
    """
    # johndoe is already an admin.
    # NOT_IN_WORKDAY does not exist in workday_employees.
    # sarahconnor is valid and new.
    payload = {
        "user_ids": ["johndoe", "sarahconnor", "NOT_IN_WORKDAY_999", "sarahconnor"]
    }
    response = client.post("/api/admin-users", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["total_inserted"] == 1
    assert data["inserted"][0]["user_id"] == "sarahconnor"

    assert "johndoe" in data["skipped"]
    assert "NOT_IN_WORKDAY_999" in data["invalid"]
    assert data["total_invalid"] == 1


def test_bulk_add_admin_users_empty_selection(client: TestClient):
    """
    Test POST /api/admin-users handles empty selections safely without error.
    """
    payload = {"user_ids": []}
    response = client.post("/api/admin-users", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["total_inserted"] == 0
    assert data["inserted"] == []
    assert data["skipped"] == []
    assert data["invalid"] == []


def test_post_and_get_available_users_routes_prevent_405(client: TestClient):
    """
    Verify that calling GET and POST on /api/admin-users/available-users succeeds
    and does NOT result in HTTP 405 Method Not Allowed.
    """
    # GET /available-users returns 200 OK
    get_res = client.get("/api/admin-users/available-users")
    assert get_res.status_code == 200

    # POST /available-users returns 201 Created (alias route prevents 405)
    post_res = client.post("/api/admin-users/available-users", json={"user_ids": ["sarahconnor"]})
    assert post_res.status_code == 201
    assert post_res.json()["total_inserted"] == 1


def test_bulk_add_database_rollback_on_failure(client: TestClient):
    """
    Verify that a database transaction failure rolls back all pending changes.
    """
    with patch.object(Session, "commit", side_effect=Exception("Database connection failure")):
        try:
            client.post("/api/admin-users", json={"user_ids": ["sarahconnor"]})
        except Exception:
            pass

    # Verify that sarahconnor was NOT committed
    list_res = client.get("/api/admin-users")
    admin_ids = [u["admin_user_id"] for u in list_res.json()]
    assert "sarahconnor" not in admin_ids


def test_delete_admin_user(client: TestClient):
    """
    Test DELETE /api/admin-users/{admin_user_id}.
    """
    response = client.delete("/api/admin-users/johndoe")
    assert response.status_code == 200
    data = response.json()
    assert "removed successfully" in data["message"]

    # Delete again should return 404
    not_found_res = client.delete("/api/admin-users/johndoe")
    assert not_found_res.status_code == 404

    # johndoe is now back in available users
    avail_res = client.get("/api/admin-users/available-users")
    assert avail_res.status_code == 200
    avail_ids = [u["user_id"] for u in avail_res.json()["items"]]
    assert "johndoe" in avail_ids


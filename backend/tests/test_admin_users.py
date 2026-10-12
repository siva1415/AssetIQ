from fastapi.testclient import TestClient


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


def test_add_admin_users_and_safe_duplicates(client: TestClient):
    """
    Test POST /api/admin-users handles single, lists, and duplicate additions safely.
    """
    # 1. Add new admin user
    payload = {"admin_user_id": "sarahconnor"}
    response = client.post("/api/admin-users", json=payload)
    assert response.status_code == 201
    data = response.json()
    ids = [u["admin_user_id"] for u in data]
    assert "sarahconnor" in ids
    assert "johndoe" in ids

    # 2. Add duplicate user - must not fail
    dup_res = client.post("/api/admin-users", json={"admin_user_id": "sarahconnor"})
    assert dup_res.status_code == 201

    # 3. Add list of users
    list_payload = ["alexturner"]
    list_res = client.post("/api/admin-users", json=list_payload)
    assert list_res.status_code == 201
    list_data = list_res.json()
    new_ids = [u["admin_user_id"] for u in list_data]
    assert "alexturner" in new_ids


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

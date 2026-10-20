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
    Test GET /api/admin-users/available-users returns only ACTIVE Workday employees not already in admin_users.
    Verifies required fields: user_id, full_name, email_work, employee_status.
    Verifies that registered admin (johndoe) is excluded.
    Verifies that inactive/terminated employee (alexturner) is excluded.
    """
    response = client.get("/api/admin-users/available-users")
    assert response.status_code == 200
    data = response.json()

    # Pagination metadata - only sarahconnor is active and not an admin
    assert data["total"] == 1
    assert data["total_pages"] == 1
    assert data["page"] == 1
    assert data["page_size"] == 10

    items = data["items"]
    assert len(items) == 1
    user_ids = [item["user_id"] for item in items]
    assert "sarahconnor" in user_ids
    assert "alexturner" not in user_ids  # Terminated/inactive excluded
    assert "johndoe" not in user_ids  # Already an admin excluded

    # Verify required fields
    sarah = next(i for i in items if i["user_id"] == "sarahconnor")
    assert sarah["full_name"] == "Sarah Connor"
    assert sarah["email_work"] == "sarah.connor@enterprise.com"
    assert sarah["employee_status"] == "Active"


def test_available_users_searching_and_filtering(client: TestClient):
    """
    Test searching by user ID, full name, and work email on GET /api/admin-users/available-users.
    Verifies case-insensitivity and ensures search results contain only active employees.
    """
    # 1. Search by user ID (case-insensitive)
    res_id = client.get("/api/admin-users/available-users?search=sarah")
    assert res_id.status_code == 200
    items_id = res_id.json()["items"]
    assert len(items_id) == 1
    assert items_id[0]["user_id"] == "sarahconnor"

    # 2. Search by full name for active employee (case-insensitive)
    res_name = client.get("/api/admin-users/available-users?search=Sarah")
    assert res_name.status_code == 200
    items_name = res_name.json()["items"]
    assert len(items_name) == 1
    assert items_name[0]["user_id"] == "sarahconnor"

    # 3. Search for inactive employee "Alex" should return 0 results
    res_inactive = client.get("/api/admin-users/available-users?search=Alex")
    assert res_inactive.status_code == 200
    assert len(res_inactive.json()["items"]) == 0
    assert res_inactive.json()["total"] == 0

    # 4. Search by work email domain - only active non-admin matches
    res_email = client.get("/api/admin-users/available-users?search=enterprise.com")
    assert res_email.status_code == 200
    assert res_email.json()["total"] == 1
    assert res_email.json()["items"][0]["user_id"] == "sarahconnor"

    # 5. Explicit parameter filtering
    res_param = client.get("/api/admin-users/available-users?user_id=sarahconnor")
    assert res_param.status_code == 200
    assert len(res_param.json()["items"]) == 1

    # 6. Empty search string safely returns all available active employees without filtering out all
    res_empty_str = client.get("/api/admin-users/available-users?search=   ")
    assert res_empty_str.status_code == 200
    assert res_empty_str.json()["total"] == 1


def test_available_users_pagination(client: TestClient, db_session: Session):
    """
    Test pagination parameters (page, page_size) and envelopes on GET /api/admin-users/available-users.
    Seeds additional active employees to test multi-page pagination.
    """
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    emp4 = WorkdayEmployee(
        employee_id=4,
        user_id="emilywatson",
        full_name="Emily Watson",
        email_work="emily.watson@enterprise.com",
        department="Engineering",
        division="Product Dev",
        job_title="QA Engineer",
        employee_status="ACTIVE",
        created_at=now_utc,
    )
    emp5 = WorkdayEmployee(
        employee_id=5,
        user_id="charliebrown",
        full_name="Charlie Brown",
        email_work="charlie.brown@enterprise.com",
        department="Finance",
        division="Accounting",
        job_title="Financial Analyst",
        employee_status="active",
        created_at=now_utc,
    )
    db_session.add_all([emp4, emp5])
    db_session.commit()

    # Total active non-admin employees = 3 (charliebrown, emilywatson, sarahconnor)
    # Page 1, page_size 2
    p1 = client.get("/api/admin-users/available-users?page=1&page_size=2")
    assert p1.status_code == 200
    d1 = p1.json()
    assert len(d1["items"]) == 2
    assert d1["total"] == 3
    assert d1["total_pages"] == 2
    assert d1["page"] == 1
    assert d1["page_size"] == 2

    # Page 2, page_size 2
    p2 = client.get("/api/admin-users/available-users?page=2&page_size=2")
    assert p2.status_code == 200
    d2 = p2.json()
    assert len(d2["items"]) == 1
    assert d2["page"] == 2
    assert d2["total"] == 3

    # Ensure no duplicates between pages
    page1_ids = [item["user_id"] for item in d1["items"]]
    page2_ids = [item["user_id"] for item in d2["items"]]
    assert not set(page1_ids).intersection(set(page2_ids))


def test_available_users_active_status_filtering_variations(client: TestClient, db_session: Session):
    """
    Requirement 1: Verify case-insensitive filtering WHERE UPPER(TRIM(employee_status)) = 'ACTIVE'.
    Must include 'ACTIVE', 'Active', 'active', and padded '  Active  ',
    while strictly excluding 'INACTIVE', null, and other statuses.
    """
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee
    from app.models.admin_user import AdminUser

    now_utc = datetime.now(timezone.utc)
    test_employees = [
        WorkdayEmployee(
            employee_id=10,
            user_id="status_upper",
            full_name="Status Upper",
            email_work="upper@enterprise.com",
            employee_status="ACTIVE",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=11,
            user_id="status_lower",
            full_name="Status Lower",
            email_work="lower@enterprise.com",
            employee_status="active",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=12,
            user_id="status_padded",
            full_name="Status Padded",
            email_work="padded@enterprise.com",
            employee_status="  Active  ",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=13,
            user_id="status_inactive",
            full_name="Status Inactive",
            email_work="inactive@enterprise.com",
            employee_status="INACTIVE",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=14,
            user_id="status_null",
            full_name="Status Null",
            email_work="null@enterprise.com",
            employee_status=None,
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=15,
            user_id="status_other",
            full_name="Status Other",
            email_work="other@enterprise.com",
            employee_status="On Leave",
            created_at=now_utc,
        ),
    ]
    db_session.add_all(test_employees)
    db_session.commit()
    from sqlalchemy import text
    db_session.execute(text("UPDATE workday_employees SET employee_status = NULL WHERE user_id = 'status_null'"))
    db_session.commit()

    response = client.get("/api/admin-users/available-users?page_size=100")
    assert response.status_code == 200
    data = response.json()
    uids = [u["user_id"] for u in data["items"]]

    # Active status variations should be included
    assert "status_upper" in uids
    assert "status_lower" in uids
    assert "status_padded" in uids
    assert "sarahconnor" in uids  # From default seed

    # Inactive, Null, Terminated, and On Leave should NOT be included
    assert "status_inactive" not in uids
    assert "status_null" not in uids
    assert "status_other" not in uids
    assert "alexturner" not in uids

    # Existing admin should NOT be included
    assert "johndoe" not in uids


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


def test_available_users_search_by_department(client: TestClient, db_session: Session):
    """
    Requirement 3: Match search query against department in addition to full_name, user_id, and email_work.
    """
    # sarahconnor is in Security department
    res = client.get("/api/admin-users/available-users?search=Security")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["user_id"] == "sarahconnor"
    assert data["items"][0]["department"] == "Security"

    # Case-insensitive department search with leading/trailing spaces
    res_lower = client.get("/api/admin-users/available-users?search=  security  ")
    assert res_lower.status_code == 200
    assert res_lower.json()["total"] == 1
    assert res_lower.json()["items"][0]["user_id"] == "sarahconnor"

    # Non-matching department search
    res_nomatch = client.get("/api/admin-users/available-users?search=NonExistentDepartment999")
    assert res_nomatch.status_code == 200
    assert res_nomatch.json()["total"] == 0
    assert len(res_nomatch.json()["items"]) == 0


def test_available_users_pagination_parameter_validation(client: TestClient):
    """
    Requirement 2: Validate query parameters:
    - page: min 1
    - page_size: min 1, max 100
    Invalid parameters should return HTTP 422.
    """
    # page < 1
    res_page_0 = client.get("/api/admin-users/available-users?page=0")
    assert res_page_0.status_code == 422

    res_page_neg = client.get("/api/admin-users/available-users?page=-1")
    assert res_page_neg.status_code == 422

    # page_size < 1
    res_size_0 = client.get("/api/admin-users/available-users?page_size=0")
    assert res_size_0.status_code == 422

    res_size_neg = client.get("/api/admin-users/available-users?page_size=-5")
    assert res_size_neg.status_code == 422

    # page_size > 100
    res_size_101 = client.get("/api/admin-users/available-users?page_size=101")
    assert res_size_101.status_code == 422

    # page_size non-integer string
    res_size_str = client.get("/api/admin-users/available-users?page_size=invalid")
    assert res_size_str.status_code == 422

    # Valid boundary values: page=1, page_size=1 and page_size=100
    res_size_1 = client.get("/api/admin-users/available-users?page=1&page_size=1")
    assert res_size_1.status_code == 200
    assert res_size_1.json()["page_size"] == 1

    res_size_100 = client.get("/api/admin-users/available-users?page=1&page_size=100")
    assert res_size_100.status_code == 200
    assert res_size_100.json()["page_size"] == 100


def test_available_users_server_side_pagination_and_count(client: TestClient, db_session: Session):
    """
    Requirements 2, 3, 4:
    Seed multiple active employees and verify server-side page navigation,
    limit/offset calculations, and exact total count consistency.
    """
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    new_emps = [
        WorkdayEmployee(
            employee_id=50,
            user_id="alice_active",
            full_name="Alice Active",
            email_work="alice@enterprise.com",
            department="DevOps",
            employee_status="ACTIVE",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=51,
            user_id="bob_active",
            full_name="Bob Active",
            email_work="bob@enterprise.com",
            department="DevOps",
            employee_status="Active",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=52,
            user_id="carol_active",
            full_name="Carol Active",
            email_work="carol@enterprise.com",
            department="DevOps",
            employee_status="active",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=53,
            user_id="dave_inactive",
            full_name="Dave Inactive",
            email_work="dave@enterprise.com",
            department="DevOps",
            employee_status="INACTIVE",
            created_at=now_utc,
        ),
    ]
    db_session.add_all(new_emps)
    db_session.commit()

    # Search for 'DevOps': should only find alice, bob, carol (3 total, dave is inactive)
    res_search = client.get("/api/admin-users/available-users?search=DevOps&page=1&page_size=2")
    assert res_search.status_code == 200
    d_search = res_search.json()
    assert d_search["total"] == 3
    assert d_search["total_pages"] == 2
    assert d_search["page"] == 1
    assert d_search["page_size"] == 2
    assert len(d_search["items"]) == 2

    # Page 2
    res_search_p2 = client.get("/api/admin-users/available-users?search=DevOps&page=2&page_size=2")
    assert res_search_p2.status_code == 200
    d_search_p2 = res_search_p2.json()
    assert d_search_p2["page"] == 2
    assert len(d_search_p2["items"]) == 1
    assert d_search_p2["total"] == 3

    # Ensure no overlap between page 1 and page 2
    p1_users = {u["user_id"] for u in d_search["items"]}
    p2_users = {u["user_id"] for u in d_search_p2["items"]}
    assert p1_users.isdisjoint(p2_users)
    assert p1_users | p2_users == {"alice_active", "bob_active", "carol_active"}



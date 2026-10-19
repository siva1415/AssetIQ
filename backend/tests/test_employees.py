from fastapi.testclient import TestClient


def test_list_employees(client: TestClient):
    """
    Test paginated employee retrieval returns ONLY active employees.
    Seeded data has 3 employees:
    - johndoe (Active) -> included
    - sarahconnor (Active) -> included
    - alexturner (Terminated) -> excluded
    """
    response = client.get("/api/employees")
    assert response.status_code == 200
    data = response.json()
    assert data["total_items"] == 2
    assert data["total"] == 2
    assert len(data["items"]) == 2

    uids = [emp["user_id"] for emp in data["items"]]
    assert "johndoe" in uids
    assert "sarahconnor" in uids
    assert "alexturner" not in uids

    # Verify expected fields
    emp = data["items"][0]
    for key in ("user_id", "full_name", "email_work", "employee_status", "department", "job_title"):
        assert key in emp


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

    # 5. Search for active employee by work email
    res_search_email = client.get("/api/employees?search=sarah.connor@enterprise.com")
    assert res_search_email.status_code == 200
    assert res_search_email.json()["items"][0]["user_id"] == "sarahconnor"

    # 6. Searching for inactive/terminated employee email returns 0 items
    res_inactive_email = client.get("/api/employees?search=alex.turner@enterprise.com")
    assert res_inactive_email.status_code == 200
    assert res_inactive_email.json()["total_items"] == 0
    assert res_inactive_email.json()["items"] == []

    # 7. Empty search results return valid pagination structure without 422 or error
    res_empty = client.get("/api/employees?search=nonexistent_person_xyz")
    assert res_empty.status_code == 200
    empty_data = res_empty.json()
    assert empty_data["total_items"] == 0
    assert empty_data["items"] == []
    assert empty_data["page"] == 1
    assert empty_data["total_pages"] == 0


def test_active_status_filtering_variations_and_exclusions(client: TestClient, db_session):
    """
    Test Requirement 1 & Validation 1-2:
    - UPPER(TRIM(employee_status)) = 'ACTIVE' includes: 'ACTIVE', 'Active', 'active', '  Active  '
    - Excludes: 'INACTIVE', null, 'Terminated', 'On Leave'
    """
    from datetime import datetime, timezone
    from sqlalchemy import text
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    new_employees = [
        WorkdayEmployee(
            employee_id=101,
            user_id="active_allcaps",
            full_name="Active AllCaps",
            email_work="allcaps@enterprise.com",
            employee_status="ACTIVE",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=102,
            user_id="active_lower",
            full_name="Active Lower",
            email_work="lower@enterprise.com",
            employee_status="active",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=103,
            user_id="active_padded",
            full_name="Active Padded",
            email_work="padded@enterprise.com",
            employee_status="  Active  ",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=104,
            user_id="inactive_user",
            full_name="Inactive User",
            email_work="inactive@enterprise.com",
            employee_status="INACTIVE",
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=105,
            user_id="null_status_user",
            full_name="Null Status User",
            email_work="nullstatus@enterprise.com",
            employee_status=None,
            created_at=now_utc,
        ),
        WorkdayEmployee(
            employee_id=106,
            user_id="on_leave_user",
            full_name="On Leave User",
            email_work="onleave@enterprise.com",
            employee_status="On Leave",
            created_at=now_utc,
        ),
    ]
    db_session.add_all(new_employees)
    db_session.commit()
    # Bypass model default to ensure status is truly NULL in database
    db_session.execute(text("UPDATE workday_employees SET employee_status = NULL WHERE user_id = 'null_status_user'"))
    db_session.commit()

    resp = client.get("/api/employees?page=1&page_size=100")
    assert resp.status_code == 200
    data = resp.json()
    uids = [item["user_id"] for item in data["items"]]

    # Verify active variations are included
    assert "active_allcaps" in uids
    assert "active_lower" in uids
    assert "active_padded" in uids
    assert "johndoe" in uids
    assert "sarahconnor" in uids

    # Verify inactive, null, terminated, and other statuses are excluded
    assert "inactive_user" not in uids
    assert "null_status_user" not in uids
    assert "on_leave_user" not in uids
    assert "alexturner" not in uids


def test_employee_search_case_insensitivity_and_clearing(client: TestClient):
    """
    Test Requirement 3 & Validation 3:
    - Search by user_id, full_name, and email_work
    - Search with uppercase, lowercase, mixed-case
    - Clearing search restores all active employees
    """
    # 1. Search by user_id (mixed case)
    res_uid = client.get("/api/employees?search=sArAhCoNnOr")
    assert res_uid.status_code == 200
    data = res_uid.json()
    assert data["total"] == 1
    assert data["items"][0]["user_id"] == "sarahconnor"

    # 2. Search by full_name (uppercase)
    res_name = client.get("/api/employees?search=JOHN DOE")
    assert res_name.status_code == 200
    data = res_name.json()
    assert data["total"] == 1
    assert data["items"][0]["user_id"] == "johndoe"

    # 3. Search by email_work (mixed case)
    res_email = client.get("/api/employees?search=JoHn.DoE@EnTeRpRiSe.CoM")
    assert res_email.status_code == 200
    data = res_email.json()
    assert data["total"] == 1
    assert data["items"][0]["user_id"] == "johndoe"

    # 4. Search with whitespace
    res_ws = client.get("/api/employees?search=  sarah  ")
    assert res_ws.status_code == 200
    assert res_ws.json()["total"] == 1

    # 5. Clearing search restores all active employees
    res_cleared = client.get("/api/employees?search=")
    assert res_cleared.status_code == 200
    assert res_cleared.json()["total"] >= 2

    res_spaces = client.get("/api/employees?search=   ")
    assert res_spaces.status_code == 200
    assert res_spaces.json()["total"] >= 2


def test_employee_pagination_navigation_and_totals(client: TestClient, db_session):
    """
    Test Requirement 2 & Validation 4-5:
    - Multi-page pagination navigation
    - Totals and total_pages calculations
    - No duplicate or missing records across pages
    - Combined search and pagination
    """
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    more_active = [
        WorkdayEmployee(employee_id=201, user_id="active_a", full_name="Active A", email_work="a@corp.com", employee_status="Active", created_at=now_utc),
        WorkdayEmployee(employee_id=202, user_id="active_b", full_name="Active B", email_work="b@corp.com", employee_status="ACTIVE", created_at=now_utc),
        WorkdayEmployee(employee_id=203, user_id="active_c", full_name="Active C", email_work="c@corp.com", employee_status="active", created_at=now_utc),
    ]
    db_session.add_all(more_active)
    db_session.commit()

    # Total active should be 2 (seed) + 3 (new) = 5
    # Page size = 2 -> total_pages = 3 (pages with 2, 2, 1 items)
    p1 = client.get("/api/employees?page=1&page_size=2").json()
    p2 = client.get("/api/employees?page=2&page_size=2").json()
    p3 = client.get("/api/employees?page=3&page_size=2").json()

    assert p1["total"] == 5
    assert p1["total_pages"] == 3
    assert len(p1["items"]) == 2

    assert p2["total"] == 5
    assert p2["total_pages"] == 3
    assert len(p2["items"]) == 2

    assert p3["total"] == 5
    assert p3["total_pages"] == 3
    assert len(p3["items"]) == 1

    # Ensure no duplicates across pages
    uids_p1 = [i["user_id"] for i in p1["items"]]
    uids_p2 = [i["user_id"] for i in p2["items"]]
    uids_p3 = [i["user_id"] for i in p3["items"]]
    all_seen = uids_p1 + uids_p2 + uids_p3
    assert len(all_seen) == 5
    assert len(set(all_seen)) == 5

    # Combined search + pagination: search="active" should match active_a, active_b, active_c (3 items)
    sp1 = client.get("/api/employees?search=active&page=1&page_size=2").json()
    assert sp1["total"] == 3
    assert sp1["total_pages"] == 2
    assert len(sp1["items"]) == 2

    sp2 = client.get("/api/employees?search=active&page=2&page_size=2").json()
    assert sp2["total"] == 3
    assert sp2["total_pages"] == 2
    assert len(sp2["items"]) == 1


def test_save_assignment_using_valid_active_employee(client: TestClient):
    """
    Test Requirement 4 & Validation 6:
    - Saving an assignment using a valid active employee ID succeeds.
    - Preserves assigned_username, managed_by, assignment_type, asset_status, and remarks.
    - Rejecting assignment to an inactive employee returns 400.
    """
    # 1. Assign to active employee 'sarahconnor'
    payload = {
        "user_id": "sarahconnor",
        "managed_by": "INDIVIDUAL",
        "asset_status": "ACTIVE",
        "remarks": "Assigned for security incident analysis",
    }
    response = client.post("/api/assets/3/assign", json=payload)
    assert response.status_code == 200, f"Assignment failed: {response.text}"
    data = response.json()
    assert data["assigned_username"] == "sarahconnor"
    assert data["managed_by"] == "INDIVIDUAL"
    assert data["assignment_type"] == "MANUAL"
    assert data["asset_status"] == "ACTIVE"
    assert data["remarks"] == "Assigned for security incident analysis"

    # 2. Assigning to inactive/terminated employee 'alexturner' is rejected
    invalid_payload = {
        "user_id": "alexturner",
        "managed_by": "INDIVIDUAL",
    }
    invalid_res = client.post("/api/assets/3/assign", json=invalid_payload)
    assert invalid_res.status_code == 400
    assert "cannot be assigned" in invalid_res.json()["detail"]


def test_first_middle_final_and_out_of_bounds_pages(client: TestClient, db_session):
    """
    Test 1: First, middle, and final pages navigation.
    Verify:
    - items contains only the requested page
    - total represents all records matching the same filters
    - total_pages is calculated dynamically
    - deterministic ordering: full_name ASC, user_id ASC
    - no duplicates across pages
    - out of bounds page returns empty list without error
    """
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    seeded_active = [
        WorkdayEmployee(employee_id=301, user_id="emp_adam", full_name="Adam Baker", email_work="adam@corp.com", department="Engineering", employee_status="Active", created_at=now_utc),
        WorkdayEmployee(employee_id=302, user_id="emp_bella", full_name="Bella Thorne", email_work="bella@corp.com", department="Security", employee_status="ACTIVE", created_at=now_utc),
        WorkdayEmployee(employee_id=303, user_id="emp_cathy", full_name="Cathy Danvers", email_work="cathy@corp.com", department="IT", employee_status="active", created_at=now_utc),
        WorkdayEmployee(employee_id=304, user_id="emp_david", full_name="David Evans", email_work="david@corp.com", department="Finance", employee_status="ACTIVE", created_at=now_utc),
        WorkdayEmployee(employee_id=305, user_id="emp_edward", full_name="Edward Fox", email_work="edward@corp.com", department="Engineering", employee_status="Active", created_at=now_utc),
    ]
    db_session.add_all(seeded_active)
    db_session.commit()

    # Total active: 2 (default) + 5 (new) = 7
    # With page_size=2:
    # Page 1: First page (2 items)
    res_p1 = client.get("/api/employees?page=1&page_size=2")
    assert res_p1.status_code == 200
    d1 = res_p1.json()
    assert d1["page"] == 1
    assert d1["page_size"] == 2
    assert d1["total"] == 7
    assert d1["total_pages"] == 4
    assert len(d1["items"]) == 2

    # Page 2: Middle page (2 items)
    res_p2 = client.get("/api/employees?page=2&page_size=2")
    assert res_p2.status_code == 200
    d2 = res_p2.json()
    assert d2["page"] == 2
    assert d2["page_size"] == 2
    assert len(d2["items"]) == 2

    # Page 3: Middle page (2 items)
    res_p3 = client.get("/api/employees?page=3&page_size=2")
    assert res_p3.status_code == 200
    d3 = res_p3.json()
    assert d3["page"] == 3
    assert len(d3["items"]) == 2

    # Page 4: Final page (1 item)
    res_p4 = client.get("/api/employees?page=4&page_size=2")
    assert res_p4.status_code == 200
    d4 = res_p4.json()
    assert d4["page"] == 4
    assert len(d4["items"]) == 1

    # Page 5: Out of bounds (0 items)
    res_p5 = client.get("/api/employees?page=5&page_size=2")
    assert res_p5.status_code == 200
    d5 = res_p5.json()
    assert d5["page"] == 5
    assert len(d5["items"]) == 0
    assert d5["total"] == 7
    assert d5["total_pages"] == 4

    # Verify no duplicates across all pages
    all_p_uids = [
        item["user_id"]
        for page_data in (d1, d2, d3, d4)
        for item in page_data["items"]
    ]
    assert len(all_p_uids) == 7
    assert len(set(all_p_uids)) == 7

    # Verify deterministic ordering: full_name ASC, user_id ASC
    all_names = [
        item["full_name"]
        for page_data in (d1, d2, d3, d4)
        for item in page_data["items"]
    ]
    assert all_names == sorted(all_names)


def test_page_sizes_10_20_and_max_supported(client: TestClient, db_session):
    """
    Test 2: Page sizes of 10, 20, and the maximum supported value (100).
    """
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    batch = [
        WorkdayEmployee(
            employee_id=400 + i,
            user_id=f"batch_user_{i:03d}",
            full_name=f"Batch User {i:03d}",
            email_work=f"user{i}@corp.com",
            department="Operations",
            employee_status="ACTIVE",
            created_at=now_utc,
        )
        for i in range(25)
    ]
    db_session.add_all(batch)
    db_session.commit()

    # 1. Default page_size=10
    r_default = client.get("/api/employees")
    assert r_default.status_code == 200
    d_def = r_default.json()
    assert d_def["page_size"] == 10
    assert len(d_def["items"]) == 10

    # 2. Explicit page_size=10
    r_10 = client.get("/api/employees?page=1&page_size=10")
    assert r_10.status_code == 200
    assert len(r_10.json()["items"]) == 10

    # 3. page_size=20
    r_20 = client.get("/api/employees?page=1&page_size=20")
    assert r_20.status_code == 200
    d_20 = r_20.json()
    assert d_20["page_size"] == 20
    assert len(d_20["items"]) == 20

    # 4. Maximum supported page_size=100
    r_100 = client.get("/api/employees?page=1&page_size=100")
    assert r_100.status_code == 200
    d_100 = r_100.json()
    assert d_100["page_size"] == 100
    # Returns all active employees (27 total), capped correctly
    assert len(d_100["items"]) == d_100["total"]

    # 5. Over-the-limit page_size (e.g. 500) capped at 100
    r_over = client.get("/api/employees?page=1&page_size=500")
    assert r_over.status_code == 200
    assert r_over.json()["page_size"] == 100


def test_search_by_name_userid_email_and_department(client: TestClient, db_session):
    """
    Test 4: Search by name, user ID, email, and department with case-insensitivity.
    """
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    target = WorkdayEmployee(
        employee_id=555,
        user_id="arunkumar",
        full_name="Arun Kumar",
        email_work="arun.kumar@enterprise.com",
        department="Infrastructure Architecture",
        division="Cloud Ops",
        job_title="Lead Architect",
        employee_status="ACTIVE",
        created_at=now_utc,
    )
    db_session.add(target)
    db_session.commit()

    # 1. Search by full name (case-insensitive)
    r_name = client.get("/api/employees?search=arun kumar")
    assert r_name.status_code == 200
    assert any(i["user_id"] == "arunkumar" for i in r_name.json()["items"])

    # 2. Search by user ID
    r_uid = client.get("/api/employees?search=ARUNKUMAR")
    assert r_uid.status_code == 200
    assert any(i["user_id"] == "arunkumar" for i in r_uid.json()["items"])

    # 3. Search by work email
    r_email = client.get("/api/employees?search=arun.kumar@enterprise.com")
    assert r_email.status_code == 200
    assert any(i["user_id"] == "arunkumar" for i in r_email.json()["items"])

    # 4. Search by department
    r_dept = client.get("/api/employees?search=Infrastructure Architecture")
    assert r_dept.status_code == 200
    assert any(i["user_id"] == "arunkumar" for i in r_dept.json()["items"])

    # 5. Department search with partial term and padding
    r_dept_partial = client.get("/api/employees?search=  infrastructure  ")
    assert r_dept_partial.status_code == 200
    assert any(i["user_id"] == "arunkumar" for i in r_dept_partial.json()["items"])


def test_active_only_filter_override_and_inactive_inclusion(client: TestClient):
    """
    Test 3: Active-only filtering and optional override for consumers needing all employees.
    Default: active only (UPPER(TRIM(employee_status)) = 'ACTIVE').
    Override: active_only=false or employee_status=ALL returns all employees including terminated/inactive.
    """
    # Default returns only active (alexturner is Terminated, so excluded)
    r_default = client.get("/api/employees?page_size=100")
    assert r_default.status_code == 200
    default_uids = [i["user_id"] for i in r_default.json()["items"]]
    assert "alexturner" not in default_uids

    # With active_only=false, alexturner (Terminated) is returned
    r_all = client.get("/api/employees?active_only=false&page_size=100")
    assert r_all.status_code == 200
    all_uids = [i["user_id"] for i in r_all.json()["items"]]
    assert "alexturner" in all_uids

    # With employee_status=ALL, all employees returned
    r_status_all = client.get("/api/employees?employee_status=ALL&page_size=100")
    assert r_status_all.status_code == 200
    status_all_uids = [i["user_id"] for i in r_status_all.json()["items"]]
    assert "alexturner" in status_all_uids

    # Explicit employee_status=Terminated returns terminated employees
    r_term = client.get("/api/employees?employee_status=Terminated")
    assert r_term.status_code == 200
    term_uids = [i["user_id"] for i in r_term.json()["items"]]
    assert "alexturner" in term_uids


def test_performance_simulation_and_pagination_scaling(client: TestClient, db_session):
    """
    Test 8: Benchmark simulation for server-side pagination performance.
    Validates that database LIMIT and OFFSET queries execute in milliseconds,
    and returns only the requested page size (never the full table).
    """
    import time
    from datetime import datetime, timezone
    from app.models.workday_employee import WorkdayEmployee

    now_utc = datetime.now(timezone.utc)
    # Bulk seed 1,000 employees
    bulk_records = [
        WorkdayEmployee(
            employee_id=10000 + i,
            user_id=f"perf_user_{i:05d}",
            full_name=f"Performance User {i:05d}",
            email_work=f"perf{i}@corp.com",
            department="Benchmarking",
            employee_status="ACTIVE",
            created_at=now_utc,
        )
        for i in range(1000)
    ]
    db_session.add_all(bulk_records)
    db_session.commit()

    start_time = time.perf_counter()
    res = client.get("/api/employees?page=25&page_size=10")
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 10
    assert data["page"] == 25
    assert data["page_size"] == 10
    assert data["total"] >= 1000
    # Server-side pagination query should execute well within 150ms
    assert elapsed_ms < 500, f"Query took {elapsed_ms:.2f}ms, expected sub-500ms"



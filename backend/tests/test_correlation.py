from fastapi.testclient import TestClient


def test_asset_correlation_matching(client: TestClient):
    """
    Test asset correlation normalization against Workday:
    1. AST-1001: assigned_username = '  JOHNDOE  ' should correlate to 'johndoe' (John Doe)
    2. AST-1002: assigned_username = 'sarahconnor' should correlate to Sarah Connor
    3. AST-1003: assigned_username = None -> 'No assigned username'
    4. AST-1004: assigned_username = 'admin_local' -> 'Username not found in Workday'
    5. AST-1005: assigned_username = 'alexturner' (terminated) -> 'Matched Workday employee' (rule: inactive still matched)
    6. AST-1006: assigned_username = '   ' -> 'No assigned username'
    """
    # 1. Padded uppercase match
    res1 = client.get("/api/assets/1")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["workday_status"] == "Matched Workday employee"
    assert data1["full_name"] == "John Doe"
    assert data1["email_work"] == "john.doe@enterprise.com"
    assert data1["matched_employee"]["user_id"] == "johndoe"
    assert data1["matched_employee"]["full_name"] == "John Doe"
    # Ensure redundant alias representations are removed
    assert "workdayStatus" not in data1
    assert "fullName" not in data1
    assert "employee_name" not in data1

    # 2. Exact match
    res2 = client.get("/api/assets/2")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["workday_status"] == "Matched Workday employee"
    assert data2["full_name"] == "Sarah Connor"
    assert data2["matched_employee"]["user_id"] == "sarahconnor"

    # 3. None username -> No assigned username
    res3 = client.get("/api/assets/3")
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["workday_status"] == "No assigned username"
    assert data3["ownership_status"] == "UNASSIGNED"
    assert data3["full_name"] is None

    # 4. Username not in Workday
    res4 = client.get("/api/assets/4")
    assert res4.status_code == 200
    data4 = res4.json()
    assert data4["workday_status"] == "Username not found in Workday"
    assert data4["ownership_status"] == "NOT_IN_WORKDAY"
    assert data4["full_name"] is None

    # 5. Inactive employee in Workday - MUST be matched Workday employee
    res5 = client.get("/api/assets/5")
    assert res5.status_code == 200
    data5 = res5.json()
    assert data5["workday_status"] == "Matched Workday employee"
    assert data5["full_name"] == "Alex Turner"
    assert data5["employee_status"] == "Terminated"
    assert data5["matched_employee"]["user_id"] == "alexturner"

    # 6. Blank string username -> No assigned username
    res6 = client.get("/api/assets/6")
    assert res6.status_code == 200
    data6 = res6.json()
    assert data6["workday_status"] == "No assigned username"
    assert data6["ownership_status"] == "UNASSIGNED"
    assert data6["full_name"] is None

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.asset import Asset


def test_dashboard_summary_all_assets(client: TestClient):
    """
    Verify Fleet Summary 5 KPI cards on All Assets page:
    - totalAssets: 6
    - active: 3 (AST-1001, AST-1004, AST-1005)
    - needValidation: 1 (AST-1002)
    - inStock: 2 (AST-1003, AST-1006)
    - nearingEol: 2 (AST-1002, AST-1004 both ThinkPad T14 with EOL in 45 days)
    """
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()

    # The 5 primary Fleet Summary KPI metrics
    assert data["totalAssets"] == 6
    assert data["active"] == 3
    assert data["needValidation"] == 1
    assert data["inStock"] == 2
    assert data["nearingEol"] == 2

    # Verification of snake_case aliases
    assert data["total_assets"] == 6
    assert data["active_assets"] == 3
    assert data["need_validation_assets"] == 1
    assert data["in_stock_assets"] == 2
    assert data["nearing_eol"] == 2
    assert data["InStock"] == 2

    # Discovery & ownership counts
    assert data["bigfix_assets"] == 4
    assert data["jamf_assets"] == 2
    assert data["automatically_assigned"] == 2
    assert data["manually_assigned"] == 2
    assert data["unassigned_assets"] == 2
    assert data["employee_count"] == 3


def test_dashboard_summary_windows_assets_bigfix(client: TestClient):
    """
    Verify Fleet Summary 5 KPI cards on Windows Assets (BigFix) page:
    - totalAssets: 4 (AST-1001, AST-1003, AST-1005, AST-1006)
    - active: 2 (AST-1001, AST-1005)
    - needValidation: 0
    - inStock: 2 (AST-1003, AST-1006)
    - nearingEol: 0
    """
    # Test via ?source=BIGFIX
    response = client.get("/api/dashboard/summary?source=BIGFIX")
    assert response.status_code == 200
    data = response.json()

    assert data["totalAssets"] == 4
    assert data["active"] == 2
    assert data["needValidation"] == 0
    assert data["inStock"] == 2
    assert data["nearingEol"] == 0

    # Test via ?scope=windows
    res_scope = client.get("/api/dashboard/summary?scope=windows")
    assert res_scope.status_code == 200
    data_scope = res_scope.json()
    assert data_scope["totalAssets"] == 4
    assert data_scope["active"] == 2
    assert data_scope["nearingEol"] == 0


def test_dashboard_summary_mac_assets_jamf(client: TestClient):
    """
    Verify Fleet Summary 5 KPI cards on Mac Assets (Jamf) page:
    - totalAssets: 2 (AST-1002, AST-1004)
    - active: 1 (AST-1004)
    - needValidation: 1 (AST-1002)
    - inStock: 0
    - nearingEol: 2 (AST-1002, AST-1004)
    """
    # Test via ?source=JAMF
    response = client.get("/api/dashboard/summary?source=JAMF")
    assert response.status_code == 200
    data = response.json()

    assert data["totalAssets"] == 2
    assert data["active"] == 1
    assert data["needValidation"] == 1
    assert data["inStock"] == 0
    assert data["nearingEol"] == 2

    # Test via ?scope=mac
    res_scope = client.get("/api/dashboard/summary?scope=mac")
    assert res_scope.status_code == 200
    data_scope = res_scope.json()
    assert data_scope["totalAssets"] == 2
    assert data_scope["active"] == 1
    assert data_scope["needValidation"] == 1
    assert data_scope["nearingEol"] == 2


def test_dashboard_summary_ownership_scope(client: TestClient):
    """
    Verify Fleet Summary on Asset Ownership page with unassigned scope.
    """
    response = client.get("/api/dashboard/summary?is_unassigned=true")
    assert response.status_code == 200
    data = response.json()

    assert data["totalAssets"] == 2  # AST-1003, AST-1006
    assert data["inStock"] == 2
    assert data["active"] == 0
    assert data["needValidation"] == 0
    assert data["unassignedAssets"] == 2


def test_dashboard_summary_empty_filter_returns_numeric_zeros(client: TestClient):
    """
    Verify empty matching scope returns numeric 0 for all KPIs rather than null.
    """
    response = client.get("/api/dashboard/summary?source=NON_EXISTENT")
    assert response.status_code == 200
    data = response.json()

    assert data["totalAssets"] == 0
    assert data["active"] == 0
    assert data["needValidation"] == 0
    assert data["inStock"] == 0
    assert data["nearingEol"] == 0


def test_dashboard_summary_pagination_independence(client: TestClient):
    """
    Verify KPI totals aggregate over the complete dataset and do NOT change
    when pagination parameters (page, page_size) are passed.
    """
    res_unpaginated = client.get("/api/dashboard/summary")
    res_paginated = client.get("/api/dashboard/summary?page=2&page_size=1")

    assert res_unpaginated.status_code == 200
    assert res_paginated.status_code == 200

    data_unp = res_unpaginated.json()
    data_pag = res_paginated.json()

    assert data_pag["totalAssets"] == data_unp["totalAssets"] == 6
    assert data_pag["active"] == data_unp["active"] == 3
    assert data_pag["needValidation"] == data_unp["needValidation"] == 1
    assert data_pag["inStock"] == data_unp["inStock"] == 2
    assert data_pag["nearingEol"] == data_unp["nearingEol"] == 2


def test_assets_summary_endpoint_parity(client: TestClient):
    """
    Verify /api/assets/summary returns identical 5 KPI metrics.
    """
    response = client.get("/api/assets/summary")
    assert response.status_code == 200
    data = response.json()

    assert data["totalAssets"] == 6
    assert data["active"] == 3
    assert data["needValidation"] == 1
    assert data["inStock"] == 2
    assert data["nearingEol"] == 2


def test_dashboard_department_summary_all_assets(client: TestClient):
    """
    Verify GET /api/dashboard/department-summary endpoint:
    - total_assets: 6
    - total_departments: 4 (Engineering, Marketing, Security, Unassigned)
    - Correct status and discovery source breakdown per department.
    - Zero duplicate counts.
    """
    response = client.get("/api/dashboard/department-summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_assets"] == 6
    assert data["totalAssets"] == 6
    assert data["total_departments"] == 4
    assert data["totalDepartments"] == 4

    # Verify items and departments array aliases
    assert isinstance(data["items"], list)
    assert len(data["items"]) == 4
    assert len(data["departments"]) == 4

    by_dept = {item["department"]: item for item in data["items"]}
    assert "Engineering" in by_dept
    assert "Security" in by_dept
    assert "Marketing" in by_dept
    assert "Unassigned" in by_dept

    # 1. Engineering (AST-1001 assigned to '  JOHNDOE  ' -> Active, BigFix)
    eng = by_dept["Engineering"]
    assert eng["total_assets"] == 1
    assert eng["totalAssets"] == 1
    assert eng["active_assets"] == 1
    assert eng["need_validation_assets"] == 0
    assert eng["in_stock_assets"] == 0
    assert eng["bigfix_assets"] == 1
    assert eng["jamf_assets"] == 0
    assert eng["divisions"] == ["Product Dev"]

    # 2. Security (AST-1002 assigned to 'sarahconnor' -> Need Validation, Jamf)
    sec = by_dept["Security"]
    assert sec["total_assets"] == 1
    assert sec["active_assets"] == 0
    assert sec["need_validation_assets"] == 1
    assert sec["in_stock_assets"] == 0
    assert sec["bigfix_assets"] == 0
    assert sec["jamf_assets"] == 1
    assert sec["divisions"] == ["Cyber Defense"]

    # 3. Marketing (AST-1005 assigned to 'alexturner' (terminated) -> Active, BigFix)
    mkt = by_dept["Marketing"]
    assert mkt["total_assets"] == 1
    assert mkt["active_assets"] == 1
    assert mkt["need_validation_assets"] == 0
    assert mkt["in_stock_assets"] == 0
    assert mkt["bigfix_assets"] == 1
    assert mkt["jamf_assets"] == 0
    assert mkt["divisions"] == ["Growth"]

    # 4. Unassigned (AST-1003 [None], AST-1004 ['admin_local' not in Workday], AST-1006 ['   '])
    unass = by_dept["Unassigned"]
    assert unass["total_assets"] == 3
    assert unass["active_assets"] == 1  # AST-1004
    assert unass["need_validation_assets"] == 0
    assert unass["in_stock_assets"] == 2  # AST-1003, AST-1006
    assert unass["bigfix_assets"] == 2   # AST-1003, AST-1006
    assert unass["jamf_assets"] == 1     # AST-1004

    # Verify summary dictionary lookup alias
    assert data["summary"]["Engineering"] == 1
    assert data["summary"]["Security"] == 1
    assert data["summary"]["Marketing"] == 1
    assert data["summary"]["Unassigned"] == 3


def test_dashboard_department_summary_source_filtered(client: TestClient):
    """
    Verify GET /api/dashboard/department-summary with source filters.
    """
    # BIGFIX scope: AST-1001 (Engineering), AST-1003 (Unassigned), AST-1005 (Marketing), AST-1006 (Unassigned)
    res_bf = client.get("/api/dashboard/department-summary?source=BIGFIX")
    assert res_bf.status_code == 200
    data_bf = res_bf.json()
    assert data_bf["total_assets"] == 4
    summary_bf = data_bf["summary"]
    assert summary_bf["Engineering"] == 1
    assert summary_bf["Marketing"] == 1
    assert summary_bf["Unassigned"] == 2
    assert "Security" not in summary_bf

    # JAMF scope: AST-1002 (Security), AST-1004 (Unassigned)
    res_jf = client.get("/api/dashboard/department-summary?source=JAMF")
    assert res_jf.status_code == 200
    data_jf = res_jf.json()
    assert data_jf["total_assets"] == 2
    summary_jf = data_jf["summary"]
    assert summary_jf["Security"] == 1
    assert summary_jf["Unassigned"] == 1
    assert "Engineering" not in summary_jf


def test_dashboard_department_summary_as_list(client: TestClient):
    """
    Verify GET /api/dashboard/department-summary?as_list=true returns direct array.
    """
    response = client.get("/api/dashboard/department-summary?as_list=true")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 4
    depts = [item["department"] for item in data]
    assert "Engineering" in depts
    assert "Security" in depts
    assert "Marketing" in depts
    assert "Unassigned" in depts


def test_dashboard_department_summary_empty(client: TestClient, db_session: Session):
    """
    Verify empty assets table returns HTTP 200 with 0 counts, not 404.
    """
    db_session.query(Asset).delete()
    db_session.commit()

    response = client.get("/api/dashboard/department-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_assets"] == 0
    assert data["total_departments"] == 0
    assert data["items"] == []

from fastapi.testclient import TestClient
from sqlalchemy import text
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
    - Returns a JSON array at top level with one record per department.
    - Fields: department, asset_count, total_assets, active, active_assets, need_validation, in_stock.
    - Total departments: 4 (Engineering, Marketing, Security, Unassigned)
    - Zero duplicate counts.
    """
    response = client.get("/api/dashboard/department-summary")
    assert response.status_code == 200
    data = response.json()

    # Must return a top-level JSON array
    assert isinstance(data, list)
    assert len(data) == 4

    by_dept = {item["department"]: item for item in data}
    assert "Engineering" in by_dept
    assert "Security" in by_dept
    assert "Marketing" in by_dept
    assert "Unassigned" in by_dept

    # 1. Engineering (AST-1001 assigned to '  JOHNDOE  ' -> Active, BigFix)
    eng = by_dept["Engineering"]
    assert eng["department"] == "Engineering"
    assert eng["asset_count"] == 1
    assert eng["total_assets"] == 1
    assert eng["totalAssets"] == 1
    assert eng["active"] == 1
    assert eng["active_assets"] == 1
    assert eng["need_validation"] == 0
    assert eng["need_validation_assets"] == 0
    assert eng["in_stock"] == 0
    assert eng["in_stock_assets"] == 0
    assert eng["bigfix"] == 1
    assert eng["bigfix_assets"] == 1
    assert eng["jamf"] == 0
    assert eng["jamf_assets"] == 0
    assert eng["divisions"] == ["Product Dev"]

    # 2. Security (AST-1002 assigned to 'sarahconnor' -> Need Validation, Jamf)
    sec = by_dept["Security"]
    assert sec["department"] == "Security"
    assert sec["asset_count"] == 1
    assert sec["total_assets"] == 1
    assert sec["active"] == 0
    assert sec["active_assets"] == 0
    assert sec["need_validation"] == 1
    assert sec["need_validation_assets"] == 1
    assert sec["in_stock"] == 0
    assert sec["in_stock_assets"] == 0
    assert sec["bigfix"] == 0
    assert sec["bigfix_assets"] == 0
    assert sec["jamf"] == 1
    assert sec["jamf_assets"] == 1
    assert sec["divisions"] == ["Cyber Defense"]

    # 3. Marketing (AST-1005 assigned to 'alexturner' (terminated) -> Active, BigFix)
    mkt = by_dept["Marketing"]
    assert mkt["department"] == "Marketing"
    assert mkt["asset_count"] == 1
    assert mkt["total_assets"] == 1
    assert mkt["active"] == 1
    assert mkt["active_assets"] == 1
    assert mkt["need_validation"] == 0
    assert mkt["need_validation_assets"] == 0
    assert mkt["in_stock"] == 0
    assert mkt["in_stock_assets"] == 0
    assert mkt["bigfix"] == 1
    assert mkt["bigfix_assets"] == 1
    assert mkt["jamf"] == 0
    assert mkt["jamf_assets"] == 0
    assert mkt["divisions"] == ["Growth"]

    # 4. Unassigned (AST-1003 [None], AST-1004 ['admin_local' not in Workday], AST-1006 ['   '])
    unass = by_dept["Unassigned"]
    assert unass["department"] == "Unassigned"
    assert unass["asset_count"] == 3
    assert unass["total_assets"] == 3
    assert unass["active"] == 1  # AST-1004
    assert unass["active_assets"] == 1
    assert unass["need_validation"] == 0
    assert unass["need_validation_assets"] == 0
    assert unass["in_stock"] == 2  # AST-1003, AST-1006
    assert unass["in_stock_assets"] == 2
    assert unass["bigfix"] == 2   # AST-1003, AST-1006
    assert unass["bigfix_assets"] == 2
    assert unass["jamf"] == 1     # AST-1004
    assert unass["jamf_assets"] == 1


def test_dashboard_department_summary_source_filtered(client: TestClient):
    """
    Verify GET /api/dashboard/department-summary with source filters returns array.
    """
    # BIGFIX scope: AST-1001 (Engineering), AST-1003 (Unassigned), AST-1005 (Marketing), AST-1006 (Unassigned)
    res_bf = client.get("/api/dashboard/department-summary?source=BIGFIX")
    assert res_bf.status_code == 200
    data_bf = res_bf.json()
    assert isinstance(data_bf, list)
    assert sum(item["asset_count"] for item in data_bf) == 4
    by_dept_bf = {item["department"]: item for item in data_bf}
    assert by_dept_bf["Engineering"]["asset_count"] == 1
    assert by_dept_bf["Marketing"]["asset_count"] == 1
    assert by_dept_bf["Unassigned"]["asset_count"] == 2
    assert "Security" not in by_dept_bf

    # JAMF scope: AST-1002 (Security), AST-1004 (Unassigned)
    res_jf = client.get("/api/dashboard/department-summary?source=JAMF")
    assert res_jf.status_code == 200
    data_jf = res_jf.json()
    assert isinstance(data_jf, list)
    assert sum(item["asset_count"] for item in data_jf) == 2
    by_dept_jf = {item["department"]: item for item in data_jf}
    assert by_dept_jf["Security"]["asset_count"] == 1
    assert by_dept_jf["Unassigned"]["asset_count"] == 1
    assert "Engineering" not in by_dept_jf


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
    Verify empty assets table returns HTTP 200 with empty array [], not 404.
    """
    db_session.query(Asset).delete()
    db_session.commit()

    response = client.get("/api/dashboard/department-summary")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert data == []


def test_dashboard_operational_status_all_assets(client: TestClient):
    """
    Verify GET /api/dashboard/operational-status:
    Returns top-level JSON array with 4 canonical uppercase statuses:
    - ACTIVE: 3 (AST-1001, AST-1004, AST-1005)
    - REVIEW: 1 (AST-1002)
    - IN STOCK: 2 (AST-1003, AST-1006)
    - RETIRED: 0
    Total: 6 assets evaluated
    """
    response = client.get("/api/dashboard/operational-status")
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) == 4

    # Verify each item has exact keys and types
    for item in data:
        assert "status" in item
        assert "count" in item
        assert isinstance(item["status"], str)
        assert isinstance(item["count"], int)

    status_map = {item["status"]: item["count"] for item in data}
    assert status_map == {
        "ACTIVE": 3,
        "REVIEW": 1,
        "IN STOCK": 2,
        "RETIRED": 0,
    }


def test_dashboard_operational_status_scoped(client: TestClient):
    """
    Verify GET /api/dashboard/operational-status with source & scope filters:
    - BIGFIX / windows: ACTIVE=2 (AST-1001, AST-1005), REVIEW=0, IN STOCK=2 (AST-1003, AST-1006), RETIRED=0
    - JAMF / mac: ACTIVE=1 (AST-1004), REVIEW=1 (AST-1002), IN STOCK=0, RETIRED=0
    """
    # BIGFIX source
    res_bf = client.get("/api/dashboard/operational-status?source=BIGFIX")
    assert res_bf.status_code == 200
    data_bf = res_bf.json()
    assert isinstance(data_bf, list)
    map_bf = {item["status"]: item["count"] for item in data_bf}
    assert map_bf == {"ACTIVE": 2, "REVIEW": 0, "IN STOCK": 2, "RETIRED": 0}

    # Windows scope
    res_win = client.get("/api/dashboard/operational-status?scope=windows")
    assert res_win.status_code == 200
    data_win = res_win.json()
    assert isinstance(data_win, list)
    map_win = {item["status"]: item["count"] for item in data_win}
    assert map_win == {"ACTIVE": 2, "REVIEW": 0, "IN STOCK": 2, "RETIRED": 0}

    # JAMF source
    res_jf = client.get("/api/dashboard/operational-status?source=JAMF")
    assert res_jf.status_code == 200
    data_jf = res_jf.json()
    assert isinstance(data_jf, list)
    map_jf = {item["status"]: item["count"] for item in data_jf}
    assert map_jf == {"ACTIVE": 1, "REVIEW": 1, "IN STOCK": 0, "RETIRED": 0}

    # Mac scope
    res_mac = client.get("/api/dashboard/operational-status?scope=mac")
    assert res_mac.status_code == 200
    data_mac = res_mac.json()
    assert isinstance(data_mac, list)
    map_mac = {item["status"]: item["count"] for item in data_mac}
    assert map_mac == {"ACTIVE": 1, "REVIEW": 1, "IN STOCK": 0, "RETIRED": 0}


def test_dashboard_operational_status_as_list(client: TestClient):
    """
    Verify GET /api/dashboard/operational-status?as_list=true returns list of items.
    """
    response = client.get("/api/dashboard/operational-status?as_list=true")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    status_map = {item["status"]: item["count"] for item in data}
    assert status_map == {
        "ACTIVE": 3,
        "REVIEW": 1,
        "IN STOCK": 2,
        "RETIRED": 0,
    }


def test_dashboard_operational_status_empty_filter_returns_numeric_zeros(client: TestClient):
    """
    Verify non-matching filter returns numeric 0 for all status categories, not null.
    """
    response = client.get("/api/dashboard/operational-status?source=NON_EXISTENT")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    status_map = {item["status"]: item["count"] for item in data}
    assert status_map == {
        "ACTIVE": 0,
        "REVIEW": 0,
        "IN STOCK": 0,
        "RETIRED": 0,
    }


def test_dashboard_operational_status_empty_db(client: TestClient, db_session: Session):
    """
    Verify empty assets table returns HTTP 200 with 0 counts, not 404.
    """
    db_session.query(Asset).delete()
    db_session.commit()

    response = client.get("/api/dashboard/operational-status")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    status_map = {item["status"]: item["count"] for item in data}
    assert status_map == {
        "ACTIVE": 0,
        "REVIEW": 0,
        "IN STOCK": 0,
        "RETIRED": 0,
    }


def test_dashboard_operational_status_path_variations(client: TestClient):
    """
    Verify endpoint resolves under /api/dashboard/operational-status,
    /dashboard/operational-status, /api/api/dashboard/operational-status,
    and /api/assets/operational-status with or without trailing slash.
    """
    paths = [
        "/api/dashboard/operational-status",
        "/api/dashboard/operational-status/",
        "/dashboard/operational-status",
        "/dashboard/operational-status/",
        "/api/api/dashboard/operational-status",
        "/api/assets/operational-status",
    ]
    for path in paths:
        res = client.get(path)
        assert res.status_code == 200, f"Failed on path {path} with status {res.status_code}"
        data = res.json()
        assert isinstance(data, list)
        status_map = {item["status"]: item["count"] for item in data}
        assert status_map["ACTIVE"] == 3


def test_dashboard_operational_status_legacy_and_null_handling(client: TestClient, db_session: Session):
    """
    Verify legacy casing ('Need Validation', 'InStock', 'retired'),
    and NULL status handling:
    - Legacy values normalize to canonical uppercase
    - NULL values are NOT classified as ACTIVE
    """
    # Clean and insert specific test records
    db_session.query(Asset).delete()
    db_session.commit()

    db_session.execute(text("PRAGMA ignore_check_constraints = ON"))

    legacy_assets = [
        Asset(asset_id=101, asset_number="AST-L1", source="BIGFIX", asset_status="Need Validation"),
        Asset(asset_id=102, asset_number="AST-L2", source="BIGFIX", asset_status="need_validation"),
        Asset(asset_id=103, asset_number="AST-L3", source="BIGFIX", asset_status="InStock"),
        Asset(asset_id=104, asset_number="AST-L4", source="BIGFIX", asset_status="in_stock"),
        Asset(asset_id=105, asset_number="AST-L5", source="BIGFIX", asset_status="retired"),
        Asset(asset_id=106, asset_number="AST-L6", source="BIGFIX", asset_status="Active"),
        Asset(asset_id=107, asset_number="AST-L7", source="BIGFIX", asset_status=None),  # NULL
    ]
    db_session.add_all(legacy_assets)
    db_session.commit()
    db_session.execute(text("PRAGMA ignore_check_constraints = OFF"))

    res = client.get("/api/dashboard/operational-status")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    status_map = {item["status"]: item["count"] for item in data}

    assert status_map["ACTIVE"] == 1        # only 'Active'
    assert status_map["REVIEW"] == 2        # 'Need Validation' + 'need_validation'
    assert status_map["IN STOCK"] == 2      # 'InStock' + 'in_stock'
    assert status_map["RETIRED"] == 1       # 'retired'
    # NULL asset AST-L7 was NOT counted as ACTIVE!


def test_dashboard_assets_by_source_all_assets(client: TestClient):
    """
    Verify GET /api/dashboard/assets-by-source:
    Returns AssetsBySourceResponse object containing source counts
    and embedded source-summary array for chart consumption:
    - bigfix_count: 4 (AST-1001, AST-1003, AST-1005, AST-1006)
    - jamf_count: 2 (AST-1002, AST-1004)
    - other_count: 0
    - total_count: 6
    - sources: [{"source": "BIGFIX", "count": 4}, {"source": "JAMF", "count": 2}, {"source": "OTHER", "count": 0}]
    """
    response = client.get("/api/dashboard/assets-by-source")
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, dict)
    assert data["bigfix_count"] == 4
    assert data["jamf_count"] == 2
    assert data["other_count"] == 0
    assert data["total_count"] == 6

    # Verify camelCase aliases
    assert data["bigfixCount"] == 4
    assert data["jamfCount"] == 2
    assert data["otherCount"] == 0
    assert data["totalCount"] == 6

    # Verify embedded source-summary array for SourceChart
    assert "sources" in data
    assert isinstance(data["sources"], list)
    assert len(data["sources"]) == 3
    src_map = {item["source"]: item["count"] for item in data["sources"]}
    assert src_map == {"BIGFIX": 4, "JAMF": 2, "OTHER": 0}

    # Verify convenience items and dictionary lookup
    assert "items" in data
    assert "by_source" in data
    assert data["by_source"]["BIGFIX"] == 4
    assert data["by_source"]["JAMF"] == 2


def test_dashboard_assets_by_source_scoped(client: TestClient):
    """
    Verify GET /api/dashboard/assets-by-source with source filtering:
    - source=BIGFIX: bigfix_count=4, jamf_count=0, total_count=4
    - source=JAMF: bigfix_count=0, jamf_count=2, total_count=2
    """
    res_bf = client.get("/api/dashboard/assets-by-source?source=BIGFIX")
    assert res_bf.status_code == 200
    data_bf = res_bf.json()
    assert data_bf["bigfix_count"] == 4
    assert data_bf["jamf_count"] == 0
    assert data_bf["total_count"] == 4

    res_jf = client.get("/api/dashboard/assets-by-source?source=JAMF")
    assert res_jf.status_code == 200
    data_jf = res_jf.json()
    assert data_jf["bigfix_count"] == 0
    assert data_jf["jamf_count"] == 2
    assert data_jf["total_count"] == 2


def test_dashboard_assets_by_source_as_list(client: TestClient):
    """
    Verify GET /api/dashboard/assets-by-source?as_list=true returns top-level list.
    """
    response = client.get("/api/dashboard/assets-by-source?as_list=true")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    src_map = {item["source"]: item["count"] for item in data}
    assert src_map == {"BIGFIX": 4, "JAMF": 2, "OTHER": 0}


def test_dashboard_assets_by_source_null_and_unknown_handling(client: TestClient, db_session: Session):
    """
    Verify that NULL, empty, and unknown sources (e.g. 'INTUNE')
    are safely routed to other_count without being misclassified as BIGFIX or JAMF.
    """
    db_session.query(Asset).delete()
    db_session.commit()

    db_session.execute(text("PRAGMA ignore_check_constraints = ON"))
    assets = [
        Asset(asset_id=201, asset_number="AST-S1", source="BIGFIX", asset_status="ACTIVE"),
        Asset(asset_id=202, asset_number="AST-S2", source="  bigfix  ", asset_status="ACTIVE"),  # casing + whitespace
        Asset(asset_id=203, asset_number="AST-S3", source="JAMF", asset_status="ACTIVE"),
        Asset(asset_id=204, asset_number="AST-S4", source="jamf", asset_status="ACTIVE"),         # lowercase
        Asset(asset_id=205, asset_number="AST-S5", source=None, asset_status="ACTIVE"),           # NULL source
        Asset(asset_id=206, asset_number="AST-S6", source="   ", asset_status="ACTIVE"),          # whitespace source
        Asset(asset_id=207, asset_number="AST-S7", source="INTUNE", asset_status="ACTIVE"),       # unknown source
    ]
    db_session.add_all(assets)
    db_session.commit()
    db_session.execute(text("PRAGMA ignore_check_constraints = OFF"))

    res = client.get("/api/dashboard/assets-by-source")
    assert res.status_code == 200
    data = res.json()

    assert data["bigfix_count"] == 2
    assert data["jamf_count"] == 2
    assert data["other_count"] == 3  # NULL, whitespace, INTUNE
    assert data["total_count"] == 7

    src_map = {item["source"]: item["count"] for item in data["sources"]}
    assert src_map["BIGFIX"] == 2
    assert src_map["JAMF"] == 2
    assert src_map["OTHER"] == 3


def test_dashboard_assets_by_source_empty_db(client: TestClient, db_session: Session):
    """
    Verify empty assets table returns HTTP 200 with 0 counts.
    """
    db_session.query(Asset).delete()
    db_session.commit()

    response = client.get("/api/dashboard/assets-by-source")
    assert response.status_code == 200
    data = response.json()
    assert data["bigfix_count"] == 0
    assert data["jamf_count"] == 0
    assert data["other_count"] == 0
    assert data["total_count"] == 0


def test_dashboard_assets_by_source_path_variations(client: TestClient):
    """
    Verify endpoint resolves under /api/dashboard/assets-by-source,
    /api/dashboard/source-summary, /dashboard/assets-by-source, and trailing slashes.
    """
    paths = [
        "/api/dashboard/assets-by-source",
        "/api/dashboard/assets-by-source/",
        "/api/dashboard/source-summary",
        "/api/dashboard/source-summary/",
        "/api/dashboard/sources",
        "/dashboard/assets-by-source",
    ]
    for path in paths:
        res = client.get(path)
        assert res.status_code == 200, f"Failed on path {path} with status {res.status_code}"
        assert res.json()["bigfix_count"] == 4


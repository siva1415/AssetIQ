from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.asset import Asset


def test_list_assets_pagination_and_canonical_fields(client: TestClient):
    """
    Test pagination metadata and verify canonical lowercase field names:
    - asset_id, asset_number, serial_number, source, manufacturer, model,
      os_name, devicetype, managed_by, assigned_username, lastreporttime,
      asset_status, assignment_type, remarks, eol_status, eol_date.
    - Verify that NO redundant alias fields (deviceType, DeviceType, assetId,
      AssetID, macAddress, lastDiscoveryDate, eolStatus, eolDate, etc.) exist.
    """
    response = client.get("/api/assets?page=1&page_size=2")
    assert response.status_code == 200
    data = response.json()

    # Pagination metadata
    assert data["total"] == 6
    assert data["total_items"] == 6
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total_pages"] == 3
    assert len(data["items"]) == 2

    # Check canonical fields on first item
    item = data["items"][0]
    assert item["asset_id"] == 1
    assert item["asset_number"] == "AST-1001"
    assert item["serial_number"] == "SN-APP-001"
    assert item["source"] == "BIGFIX"
    assert item["manufacturer"] == "Apple"
    assert item["model"] == "MacBook Pro 16"
    assert item["os_name"] == "macOS 14 Sonoma"
    assert item["devicetype"] == "Desktop"
    assert item["macaddress"] == "3c:22:fb:01:23:45"
    assert item["managed_by"] == "INDIVIDUAL"
    assert item["assigned_username"] == "  JOHNDOE  "
    assert item["asset_status"] == "ACTIVE"
    assert item["assignment_type"] == "AUTO"
    assert item["remarks"] == "Primary developer laptop"
    assert item["lastreporttime"] is not None
    assert item["eol_status"] == "EXPIRED"
    assert item["eol_date"] is not None

    # Assert redundant aliases are completely removed from JSON output
    disallowed_keys = [
        "deviceType", "DeviceType",
        "assetId", "AssetID", "assetNumber", "serialNumber",
        "osName", "macAddress", "managedBy", "assignedUsername",
        "lastReportTime", "last_discovery_date", "lastDiscoveryDate", "LastDiscoveryDate",
        "assetStatus", "assignmentType",
        "eolStatus", "eolDate", "daysRemaining", "referenceSource", "eolInfo",
        "workdayStatus", "ownershipStatus", "correlation_status", "correlationStatus",
        "fullName", "employee_name", "employeeName", "emailWork", "jobTitle",
        "employeeStatus", "managerName", "managerUserName", "correlated_employee", "employee",
    ]
    for key in disallowed_keys:
        assert key not in item, f"Duplicate alias key '{key}' unexpectedly found in asset response"


def test_devicetype_filter_desktop_and_server(client: TestClient):
    """
    Test devicetype filtering with live database data:
    - Desktop should return all desktop devices
    - Server should return all server devices (PowerEdge R750)
    """
    # 1. Desktop filter
    res_desktop = client.get("/api/assets?devicetype=Desktop")
    assert res_desktop.status_code == 200
    data_desktop = res_desktop.json()
    assert data_desktop["total"] == 4
    for item in data_desktop["items"]:
        assert item["devicetype"] == "Desktop"
        assert "deviceType" not in item
        assert "DeviceType" not in item

    # 2. Server filter
    res_server = client.get("/api/assets?devicetype=Server")
    assert res_server.status_code == 200
    data_server = res_server.json()
    assert data_server["total"] == 2
    for item in data_server["items"]:
        assert item["devicetype"] == "Server"
        assert item["model"] == "PowerEdge R750"


def test_eol_status_filter_supported_values(client: TestClient):
    """
    Test runtime EOL status filtering against database query:
    - EXPIRED: AST-1001 (Apple MacBook Pro 16)
    - EOL SOON / NEARING EOL: AST-1002 (ThinkPad T14), AST-1004 (ThinkPad T14)
    - ACTIVE: AST-1003 (PowerEdge R750), AST-1006 (PowerEdge R750)
    - UNKNOWN: AST-1005 (HP EliteBook 840 with missing EOL reference)
    """
    # 1. Expired
    res_exp = client.get("/api/assets?eol_status=EXPIRED")
    assert res_exp.status_code == 200
    data_exp = res_exp.json()
    assert data_exp["total"] == 1
    assert data_exp["items"][0]["asset_number"] == "AST-1001"
    assert data_exp["items"][0]["eol_status"] == "EXPIRED"

    # 2. EOL SOON (and legacy NEARING EOL parameter support)
    for filter_val in ["EOL SOON", "NEARING EOL"]:
        res_near = client.get(f"/api/assets?eol_status={filter_val}")
        assert res_near.status_code == 200
        data_near = res_near.json()
        assert data_near["total"] == 2
        for it in data_near["items"]:
            assert it["eol_status"] == "EOL SOON"

    # 3. Active
    res_act = client.get("/api/assets?eol_status=ACTIVE")
    assert res_act.status_code == 200
    data_act = res_act.json()
    assert data_act["total"] == 2
    for it in data_act["items"]:
        assert it["eol_status"] == "ACTIVE"

    # 4. Unknown (missing EOL reference)
    res_unk = client.get("/api/assets?eol_status=UNKNOWN")
    assert res_unk.status_code == 200
    data_unk = res_unk.json()
    assert data_unk["total"] == 1
    assert data_unk["items"][0]["asset_number"] == "AST-1005"
    assert data_unk["items"][0]["eol_status"] == "UNKNOWN"
    assert data_unk["items"][0]["eol_date"] is None


def test_asset_detail_canonical_schema_consistency(client: TestClient):
    """
    Verify GET /api/assets/{asset_id} returns identical canonical field structure
    without duplicate casing variants.
    """
    res = client.get("/api/assets/1")
    assert res.status_code == 200
    item = res.json()

    assert item["asset_id"] == 1
    assert item["manufacturer"] == "Apple"
    assert item["model"] == "MacBook Pro 16"
    assert item["devicetype"] == "Desktop"
    assert item["managed_by"] == "INDIVIDUAL"
    assert item["eol_status"] == "EXPIRED"
    assert "deviceType" not in item
    assert "DeviceType" not in item
    assert "eolStatus" not in item
    assert "assetId" not in item
    assert "managedBy" not in item

    # Verify asset with GROUP managed_by (asset 3)
    res_group = client.get("/api/assets/3")
    assert res_group.status_code == 200
    item_group = res_group.json()
    assert item_group["asset_id"] == 3
    assert item_group["managed_by"] == "GROUP"
    assert "managedBy" not in item_group


def test_asset_detail_managed_by_null_and_values(client: TestClient, db_session: Session):
    """
    Test GET /api/assets/{asset_id} Managed By field mapping:
    - Returns 'INDIVIDUAL' for asset 1
    - Returns 'GROUP' for asset 3
    - Returns None (null) for an asset with null managed_by
    - Does not infer or confuse managed_by with source or management platform strings
    """
    # 1. INDIVIDUAL
    res_ind = client.get("/api/assets/1")
    assert res_ind.status_code == 200
    assert res_ind.json()["managed_by"] == "INDIVIDUAL"
    assert res_ind.json()["source"] == "BIGFIX"

    # 2. GROUP
    res_grp = client.get("/api/assets/3")
    assert res_grp.status_code == 200
    assert res_grp.json()["managed_by"] == "GROUP"

    # 3. NULL / None representation preserved without inference
    now_utc = datetime.now(timezone.utc)
    null_asset = Asset(
        asset_id=999,
        asset_number="AST-NULL-999",
        serial_number="SN-NULL-999",
        source="JAMF",
        manufacturer="Dell",
        model="PowerEdge R750",
        os_name="Ubuntu Linux",
        devicetype="Server",
        managed_by=None,
        asset_status="IN STOCK",
        created_at=now_utc,
    )
    db_session.add(null_asset)
    db_session.commit()

    res_null = client.get("/api/assets/999")
    assert res_null.status_code == 200
    data_null = res_null.json()
    assert data_null["managed_by"] is None
    assert data_null["managed_by"] not in ("JAMF", "BIGFIX", "JAMF PRO CLOUD", "BIGFIX CORPORATE")


def test_empty_filter_returns_valid_zero_count(client: TestClient):
    """
    Test empty filter returns total: 0 and valid pagination metadata without errors.
    """
    response = client.get("/api/assets?source=NON_EXISTENT_SOURCE")
    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 0
    assert data["total_items"] == 0
    assert data["total_pages"] == 0
    assert data["page"] == 1
    assert data["items"] == []


def test_list_assets_filter_windows_bigfix(client: TestClient):
    """
    Test Windows Assets filters by source = 'BIGFIX'.
    """
    # Test standard BIGFIX
    res_bf = client.get("/api/assets?source=BIGFIX")
    assert res_bf.status_code == 200
    data_bf = res_bf.json()
    assert data_bf["total"] == 4
    assert all(item["source"] == "BIGFIX" for item in data_bf["items"])

    # Test Windows alias
    res_win = client.get("/api/assets?source=Windows")
    assert res_win.status_code == 200
    data_win = res_win.json()
    assert data_win["total"] == 4
    assert all(item["source"] == "BIGFIX" for item in data_win["items"])


def test_list_assets_filter_mac_jamf(client: TestClient):
    """
    Test Mac Assets filters by source = 'JAMF'.
    """
    # Test standard JAMF
    res_jamf = client.get("/api/assets?source=JAMF")
    assert res_jamf.status_code == 200
    data_jamf = res_jamf.json()
    assert data_jamf["total"] == 2
    assert all(item["source"] == "JAMF" for item in data_jamf["items"])

    # Test Mac alias
    res_mac = client.get("/api/assets?source=Mac")
    assert res_mac.status_code == 200
    data_mac = res_mac.json()
    assert data_mac["total"] == 2
    assert all(item["source"] == "JAMF" for item in data_mac["items"])


def test_assets_summary_fleet_kpi_endpoint(client: TestClient):
    """
    Test /api/assets/summary alias for Fleet Summary cards.
    """
    res = client.get("/api/assets/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_assets"] == 6
    assert data["totalAssets"] == 6

    # With Windows filter
    res_win = client.get("/api/assets/summary?source=BIGFIX")
    assert res_win.status_code == 200
    data_win = res_win.json()
    assert data_win["total_assets"] == 4
    assert data_win["totalAssets"] == 4


def test_assignment_type_filter_all_assets(client: TestClient):
    """
    Test assignment_type filtering on All Assets:
    - assignment_type=Auto returns AST-1001 and AST-1005
    - assignment_type=Manual returns AST-1002 and AST-1004
    - Case-insensitive acceptance (Auto, AUTO, auto, Manual, MANUAL, manual)
    """
    # 1. Automatic Match (Auto)
    res_auto = client.get("/api/assets?assignment_type=Auto")
    assert res_auto.status_code == 200
    data_auto = res_auto.json()
    assert data_auto["total"] == 2
    for item in data_auto["items"]:
        assert item["assignment_type"] == "AUTO"
    assert {it["asset_number"] for it in data_auto["items"]} == {"AST-1001", "AST-1005"}

    # Case insensitivity for Auto
    for variant in ["auto", "AUTO", "Automatic", "Automatic Match"]:
        r = client.get(f"/api/assets?assignment_type={variant}")
        assert r.status_code == 200
        assert r.json()["total"] == 2

    # 2. Manual Assignment (Manual)
    res_manual = client.get("/api/assets?assignment_type=Manual")
    assert res_manual.status_code == 200
    data_manual = res_manual.json()
    assert data_manual["total"] == 2
    for item in data_manual["items"]:
        assert item["assignment_type"] == "MANUAL"
    assert {it["asset_number"] for it in data_manual["items"]} == {"AST-1002", "AST-1004"}

    # Case insensitivity for Manual
    for variant in ["manual", "MANUAL", "Manual Assignment"]:
        r = client.get(f"/api/assets?assignment_type={variant}")
        assert r.status_code == 200
        assert r.json()["total"] == 2


def test_assignment_type_filter_with_sorting_and_pagination(client: TestClient):
    """
    Test example query parameters from user brief:
    GET /api/assets?page=1&page_size=10&assignment_type=Auto&sort_by=last_report_time&sort_order=desc
    GET /api/assets?page=1&page_size=10&assignment_type=Manual&sort_by=last_report_time&sort_order=desc
    """
    # Auto with sorting
    res_auto = client.get("/api/assets?page=1&page_size=10&assignment_type=Auto&sort_by=last_report_time&sort_order=desc")
    assert res_auto.status_code == 200
    data_auto = res_auto.json()
    assert data_auto["total"] == 2
    assert len(data_auto["items"]) == 2
    assert all(it["assignment_type"] == "AUTO" for it in data_auto["items"])

    # Manual with sorting
    res_man = client.get("/api/assets?page=1&page_size=10&assignment_type=Manual&sort_by=last_report_time&sort_order=desc")
    assert res_man.status_code == 200
    data_man = res_man.json()
    assert data_man["total"] == 2
    assert len(data_man["items"]) == 2
    assert all(it["assignment_type"] == "MANUAL" for it in data_man["items"])


def test_assignment_type_filter_windows_mac_and_ownership(client: TestClient):
    """
    Test assignment_type filtering across Windows, Mac, and Ownership views:
    - Windows (BIGFIX) + Auto -> 2
    - Windows (BIGFIX) + Manual -> 0
    - Mac (JAMF) + Auto -> 0
    - Mac (JAMF) + Manual -> 2
    - Ownership scope + Auto -> 2
    - Ownership scope + Manual -> 2
    """
    # Windows Assets (BigFix)
    res_win_auto = client.get("/api/assets?source=BIGFIX&assignment_type=Auto")
    assert res_win_auto.status_code == 200
    assert res_win_auto.json()["total"] == 2

    res_win_manual = client.get("/api/assets?source=BIGFIX&assignment_type=Manual")
    assert res_win_manual.status_code == 200
    assert res_win_manual.json()["total"] == 0

    # Also test via scope=windows
    res_scope_win = client.get("/api/assets?scope=windows&assignment_type=Auto")
    assert res_scope_win.status_code == 200
    assert res_scope_win.json()["total"] == 2

    # Mac Assets (Jamf)
    res_mac_auto = client.get("/api/assets?source=JAMF&assignment_type=Auto")
    assert res_mac_auto.status_code == 200
    assert res_mac_auto.json()["total"] == 0

    res_mac_manual = client.get("/api/assets?source=JAMF&assignment_type=Manual")
    assert res_mac_manual.status_code == 200
    assert res_mac_manual.json()["total"] == 2

    # Also test via scope=mac
    res_scope_mac = client.get("/api/assets?scope=mac&assignment_type=Manual")
    assert res_scope_mac.status_code == 200
    assert res_scope_mac.json()["total"] == 2

    # Asset Ownership scope
    res_own_auto = client.get("/api/assets?scope=ownership&assignment_type=Auto")
    assert res_own_auto.status_code == 200
    assert res_own_auto.json()["total"] == 2

    res_own_manual = client.get("/api/assets?scope=ownership&assignment_type=Manual")
    assert res_own_manual.status_code == 200
    assert res_own_manual.json()["total"] == 2


def test_assignment_type_filter_validation_error(client: TestClient):
    """
    Test that invalid assignment_type values return HTTP 422 Unprocessable Entity.
    """
    res = client.get("/api/assets?assignment_type=INVALID_TYPE")
    assert res.status_code == 422
    assert "Invalid assignment_type" in res.json()["detail"]


def test_assets_summary_assignment_type_filter(client: TestClient):
    """
    Test Fleet Summary / KPIs endpoint with assignment_type filtering:
    - /api/assets/summary?assignment_type=Auto -> totalAssets: 2
    - /api/assets/summary?assignment_type=Manual -> totalAssets: 2
    """
    res_auto = client.get("/api/assets/summary?assignment_type=Auto")
    assert res_auto.status_code == 200
    assert res_auto.json()["totalAssets"] == 2

    res_manual = client.get("/api/assets/summary?assignment_type=Manual")
    assert res_manual.status_code == 200
    assert res_manual.json()["totalAssets"] == 2


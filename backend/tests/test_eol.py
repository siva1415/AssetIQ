from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.services.eol_service import EolService


def test_eol_calculation_boundaries():
    """
    Test EOL lifecycle mathematical boundaries:
    - Missing matching EOL date: UNKNOWN
    - EOL date before today: EXPIRED
    - EOL date from today through the next warning threshold, inclusive: EOL SOON
    - EOL date beyond the threshold: ACTIVE
    """
    today = date(2026, 1, 1)
    warning_days = 90

    # 1. Missing date -> UNKNOWN
    status, days = EolService.calculate_eol(None, warning_days=warning_days, as_of_date=today)
    assert status == "UNKNOWN"
    assert days is None

    # 2. 1 day in the past -> EXPIRED
    status, days = EolService.calculate_eol(
        today - timedelta(days=1), warning_days=warning_days, as_of_date=today
    )
    assert status == "EXPIRED"
    assert days == -1

    # 3. 100 days in the past -> EXPIRED
    status, days = EolService.calculate_eol(
        today - timedelta(days=100), warning_days=warning_days, as_of_date=today
    )
    assert status == "EXPIRED"
    assert days == -100

    # 4. Exactly today -> EOL SOON (0 days remaining)
    status, days = EolService.calculate_eol(today, warning_days=warning_days, as_of_date=today)
    assert status == "EOL SOON"
    assert days == 0

    # 5. Warning threshold boundary: exactly 90 days from today -> EOL SOON (inclusive)
    status, days = EolService.calculate_eol(
        today + timedelta(days=90), warning_days=warning_days, as_of_date=today
    )
    assert status == "EOL SOON"
    assert days == 90

    # 6. 1 day past warning threshold: 91 days from today -> ACTIVE
    status, days = EolService.calculate_eol(
        today + timedelta(days=91), warning_days=warning_days, as_of_date=today
    )
    assert status == "ACTIVE"
    assert days == 91

    # 7. Far future -> ACTIVE
    status, days = EolService.calculate_eol(
        today + timedelta(days=365), warning_days=warning_days, as_of_date=today
    )
    assert status == "ACTIVE"
    assert days == 365


def test_eol_api_endpoint(client: TestClient):
    """
    Test GET /api/eol endpoint with pagination and calculated metadata.
    """
    response = client.get("/api/eol?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 6
    assert data["total_items"] == 6
    assert len(data["items"]) == 6

    # Verify calculated statuses in response
    statuses = {item["asset_number"]: item["eol_status"] for item in data["items"]}
    assert statuses["AST-1001"] == "EXPIRED"  # MacBook Pro 16 expired 30 days ago
    assert statuses["AST-1002"] == "EOL SOON"  # ThinkPad T14 in 45 days
    assert statuses["AST-1003"] == "ACTIVE"  # PowerEdge R750 in 365 days
    assert statuses["AST-1005"] == "UNKNOWN"  # EliteBook 840 has no reference


def test_dashboard_eol_summary(client: TestClient):
    """
    Test GET /api/dashboard/eol-summary counts.
    """
    response = client.get("/api/dashboard/eol-summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_evaluated"] == 6
    assert data["expired_count"] == 1  # AST-1001
    assert data["nearing_eol_count"] == 2  # AST-1002, AST-1004 (both ThinkPad T14)
    assert data["active_count"] == 2  # AST-1003, AST-1006 (both PowerEdge R750)
    assert data["unknown_count"] == 1  # AST-1005 (EliteBook 840)


def test_exact_manufacturer_and_model_matching_rejects_partial(client: TestClient, db_session):
    """
    Test that exact matching strictly rejects:
    - Substring / prefix model matches (e.g. 'MacBook Pro' vs 'MacBook Pro 16')
    - Suffix model matches (e.g. 'ThinkPad T14s' vs 'ThinkPad T14')
    - Mismatched manufacturer (e.g. 'Dell' vs 'Apple')
    - Empty or null manufacturer or model
    - Reference record with NULL eol_date
    """
    from datetime import datetime, timezone
    from app.models.asset import Asset
    from app.models.device_eol_reference import DeviceEolReference

    now = datetime.now(timezone.utc)
    today = date.today()

    # 1. Reference with null eol_date
    ref_null_date = DeviceEolReference(
        eol_id=901,
        manufacturer="Asus",
        model="ZenBook 14",
        eol_date=None,
        reference_source="Asus Matrix",
        created_at=now,
    )
    db_session.add(ref_null_date)

    # 2. Asset with prefix model name (should NOT match 'MacBook Pro 16')
    asset_prefix = Asset(
        asset_id=9101,
        asset_number="AST-PARTIAL-1",
        source="JAMF",
        manufacturer="Apple",
        model="MacBook Pro",  # Missing '16'
        asset_status="ACTIVE",
        created_at=now,
    )
    # 3. Asset with suffix model name (should NOT match 'ThinkPad T14')
    asset_suffix = Asset(
        asset_id=9102,
        asset_number="AST-PARTIAL-2",
        source="BIGFIX",
        manufacturer="Lenovo",
        model="ThinkPad T14s Gen 3",  # Has extra suffix
        asset_status="ACTIVE",
        created_at=now,
    )
    # 4. Asset with wrong manufacturer for known model
    asset_wrong_mfg = Asset(
        asset_id=9103,
        asset_number="AST-PARTIAL-3",
        source="BIGFIX",
        manufacturer="Asus",
        model="ThinkPad T14",  # Lenovo model, not Asus
        asset_status="ACTIVE",
        created_at=now,
    )
    # 5. Asset with empty manufacturer
    asset_empty_mfg = Asset(
        asset_id=9104,
        asset_number="AST-PARTIAL-4",
        source="BIGFIX",
        manufacturer="",
        model="PowerEdge R750",
        asset_status="ACTIVE",
        created_at=now,
    )
    # 6. Asset with empty model
    asset_empty_mdl = Asset(
        asset_id=9105,
        asset_number="AST-PARTIAL-5",
        source="BIGFIX",
        manufacturer="Dell",
        model="",
        asset_status="ACTIVE",
        created_at=now,
    )
    # 7. Asset matching reference with null date
    asset_null_date = Asset(
        asset_id=9106,
        asset_number="AST-PARTIAL-6",
        source="BIGFIX",
        manufacturer="Asus",
        model="ZenBook 14",
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add_all([
        asset_prefix, asset_suffix, asset_wrong_mfg,
        asset_empty_mfg, asset_empty_mdl, asset_null_date
    ])
    db_session.commit()

    # Query all partial test assets
    for asset_num in [
        "AST-PARTIAL-1", "AST-PARTIAL-2", "AST-PARTIAL-3",
        "AST-PARTIAL-4", "AST-PARTIAL-5", "AST-PARTIAL-6"
    ]:
        res = client.get(f"/api/assets?search={asset_num}")
        assert res.status_code == 200
        items = res.json()["items"]
        assert len(items) == 1, f"Expected 1 item for {asset_num}"
        item = items[0]
        assert item["eol_status"] == "UNKNOWN", f"{asset_num} expected UNKNOWN but got {item['eol_status']}"
        assert item["eol_date"] is None, f"{asset_num} expected null eol_date"


def test_eol_parity_across_four_pages(client: TestClient):
    """
    Ensure the API data consumed by:
    1. All Assets (/api/assets)
    2. Windows Assets (/api/assets?source=BIGFIX)
    3. Mac Assets (/api/assets?source=JAMF)
    4. Asset Ownership (/api/assets?scope=ownership)
    reflects the same canonical EOL calculation and exact matching.
    """
    # 1. All Assets
    res_all = client.get("/api/assets?page_size=50")
    assert res_all.status_code == 200
    all_items = {it["asset_number"]: it for it in res_all.json()["items"]}

    # 2. Windows Assets (BigFix)
    res_win = client.get("/api/assets?source=BIGFIX&page_size=50")
    assert res_win.status_code == 200
    win_items = {it["asset_number"]: it for it in res_win.json()["items"]}

    # 3. Mac Assets (Jamf)
    res_mac = client.get("/api/assets?source=JAMF&page_size=50")
    assert res_mac.status_code == 200
    mac_items = {it["asset_number"]: it for it in res_mac.json()["items"]}

    # 4. Asset Ownership (scope=ownership)
    res_own = client.get("/api/assets?scope=ownership&page_size=50")
    assert res_own.status_code == 200
    own_items = {it["asset_number"]: it for it in res_own.json()["items"]}

    # Verify Windows assets have identical EOL fields in /api/assets and /api/assets?source=BIGFIX
    for ast_num, win_item in win_items.items():
        all_item = all_items[ast_num]
        assert win_item["eol_status"] == all_item["eol_status"]
        assert win_item["eol_date"] == all_item["eol_date"]
        assert win_item["days_remaining"] == all_item["days_remaining"]

    # Verify Mac assets have identical EOL fields in /api/assets and /api/assets?source=JAMF
    for ast_num, mac_item in mac_items.items():
        all_item = all_items[ast_num]
        assert mac_item["eol_status"] == all_item["eol_status"]
        assert mac_item["eol_date"] == all_item["eol_date"]
        assert mac_item["days_remaining"] == all_item["days_remaining"]

    # Verify Ownership assets have identical EOL fields
    for ast_num, own_item in own_items.items():
        all_item = all_items[ast_num]
        assert own_item["eol_status"] == all_item["eol_status"]
        assert own_item["eol_date"] == all_item["eol_date"]
        assert own_item["days_remaining"] == all_item["days_remaining"]

    # Verify BIGFIX device AST-1001 (MacBook Pro 16 by Apple) is EXPIRED
    assert win_items["AST-1001"]["eol_status"] == "EXPIRED"
    # Verify JAMF device AST-1002 (ThinkPad T14 by Lenovo) is EOL SOON
    assert mac_items["AST-1002"]["eol_status"] == "EOL SOON"
    # Verify EOL status is distinct from operational asset_status
    assert win_items["AST-1001"]["asset_status"] == "ACTIVE"  # operational status
    assert win_items["AST-1001"]["eol_status"] == "EXPIRED"    # EOL lifecycle status

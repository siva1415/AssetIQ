from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee


def test_hardware_asset_analysis_standard_counts(client: TestClient):
    """
    Verify live database aggregation for the Hardware Asset Analysis card on default seeded database:
    - 6 seeded assets total
    - Operating systems: exactly 3 display groups:
        - 'Windows 11': 2 (AST-1002, AST-1004)
        - 'Windows 10': 1 (AST-1005)
        - 'Mac': 1 (AST-1001)
        (AST-1003 Red Hat and AST-1006 Ubuntu are excluded)
        Total matching OS assets: 4
    - Device types: exactly 2 groups:
        - 'Laptops': 0 (zero count group present)
        - 'Desktops': 4 (AST-1001, AST-1002, AST-1004, AST-1005)
        (AST-1003 and AST-1006 Server devices are excluded)
        Total matching device assets: 4
    - Categories: exactly 2 groups:
        - 'STORE': 3 (AST-1002, AST-1003, AST-1006)
        - 'CORPORATE': 3 (AST-1001, AST-1004, AST-1005)
        Total matching category assets: 6
    """
    response = client.get("/api/dashboard/hardware-analysis")
    assert response.status_code == 200
    data = response.json()

    assert data["total_assets"] == 6
    assert data["total_os_assets"] == 4
    assert data["total_device_assets"] == 4
    assert data["total_category_assets"] == 6

    # 1. Operating Systems verification: exactly 3 display groups
    os_list = data["operating_systems"]
    assert len(os_list) == 3
    os_names = [item["name"] for item in os_list]
    assert os_names == ["Windows 11", "Windows 10", "Mac"]

    os_map = {item["name"]: item["count"] for item in os_list}
    assert os_map["Windows 11"] == 2
    assert os_map["Windows 10"] == 1
    assert os_map["Mac"] == 1

    # Check percentages
    os_pct_map = {item["name"]: item["percentage"] for item in os_list}
    assert os_pct_map["Windows 11"] == 50.0
    assert os_pct_map["Windows 10"] == 25.0
    assert os_pct_map["Mac"] == 25.0

    # 2. Device Types verification: exactly Laptops and Desktops
    dev_list = data["device_types"]
    assert len(dev_list) == 2
    dev_map = {item["name"]: item["count"] for item in dev_list}
    assert dev_map["Desktops"] == 4
    assert dev_map["Laptops"] == 0

    # Server must NOT be in dev_map
    assert "Server" not in [item["name"] for item in dev_list]

    # Percentage checks
    dev_pct_map = {item["name"]: item["percentage"] for item in dev_list}
    assert dev_pct_map["Desktops"] == 100.0
    assert dev_pct_map["Laptops"] == 0.0

    # 3. Category verification: pure category STORE and CORPORATE, no devicetype mixing
    assert "categories" in data
    cat_list = data["categories"]
    assert len(cat_list) == 2
    cat_names = [item["name"] for item in cat_list]
    assert cat_names == ["STORE", "CORPORATE"]

    cat_map = {item["name"]: item["count"] for item in cat_list}
    assert cat_map["STORE"] == 3
    assert cat_map["CORPORATE"] == 3

    cat_pct_map = {item["name"]: item["percentage"] for item in cat_list}
    assert cat_pct_map["STORE"] == 50.0
    assert cat_pct_map["CORPORATE"] == 50.0

    # Verify camelCase and map aliases
    assert "operatingSystems" in data
    assert "deviceTypes" in data
    assert "byCategory" in data
    assert "by_category" in data
    assert "by_os" in data
    assert "by_device" in data
    assert data["by_os"]["Windows 11"] == 2
    assert data["by_device"]["Desktops"] == 4
    assert data["by_device"]["Laptops"] == 0
    assert data["by_category"]["STORE"] == 3
    assert data["by_category"]["CORPORATE"] == 3


def test_category_aggregation_pure_and_isolated_from_devicetype(client: TestClient, db_session: Session):
    """
    Verify Hardware Asset Analysis – By Category:
    - Counts assets exclusively by database `category` field: STORE and CORPORATE
    - Does NOT mix devicetype (Laptop/Desktop/Server) into category aggregation:
      Laptops, Desktops, and Servers in STORE are all counted under STORE
      Laptops, Desktops, and Servers in CORPORATE are all counted under CORPORATE
    - Case & whitespace normalization (e.g. 'store', '  CORPORATE  ')
    - Excludes NULL, empty/whitespace-only, and unrecognized categories (e.g. 'WAREHOUSE')
    - Preserves stable STORE and CORPORATE group representation
    """
    now = datetime.now(timezone.utc)

    # Clear table for isolated counts
    db_session.query(Asset).delete()
    db_session.commit()

    # Seed assets covering combinations of category and devicetype
    assets = [
        # STORE category across diverse devicetypes (Laptop, Desktop, Server)
        Asset(asset_id=901, asset_number="AST-S-1", source="BIGFIX", devicetype="Desktop", category="STORE", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=902, asset_number="AST-S-2", source="JAMF", devicetype="Laptop", category="store", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=903, asset_number="AST-S-3", source="BIGFIX", devicetype="Server", category="  STORE  ", asset_status="ACTIVE", created_at=now),

        # CORPORATE category across diverse devicetypes (Desktop, Laptop, Server)
        Asset(asset_id=904, asset_number="AST-C-1", source="BIGFIX", devicetype="Desktop", category="CORPORATE", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=905, asset_number="AST-C-2", source="JAMF", devicetype="LAPTOP", category="corporate", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=906, asset_number="AST-C-3", source="BIGFIX", devicetype="Server", category="  Corporate  ", asset_status="ACTIVE", created_at=now),

        # Excluded from category (NULL, empty whitespace, unrelated category)
        Asset(asset_id=907, asset_number="AST-E-1", source="BIGFIX", devicetype="Desktop", category=None, asset_status="ACTIVE", created_at=now),
        Asset(asset_id=908, asset_number="AST-E-2", source="JAMF", devicetype="Laptop", category="   ", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=909, asset_number="AST-E-3", source="BIGFIX", devicetype="Desktop", category="WAREHOUSE", asset_status="ACTIVE", created_at=now),
    ]

    db_session.add_all(assets)
    db_session.commit()

    # 1. Test via /api/dashboard/hardware-analysis
    res = client.get("/api/dashboard/hardware-analysis")
    assert res.status_code == 200
    data = res.json()

    assert data["total_assets"] == 9
    assert data["total_category_assets"] == 6

    # Category aggregation: 3 STORE, 3 CORPORATE
    assert "categories" in data
    cat_items = {it["name"]: it["count"] for it in data["categories"]}
    assert cat_items["STORE"] == 3
    assert cat_items["CORPORATE"] == 3

    # Category percentages
    cat_pcts = {it["name"]: it["percentage"] for it in data["categories"]}
    assert cat_pcts["STORE"] == 50.0
    assert cat_pcts["CORPORATE"] == 50.0

    # by_category map
    assert data["by_category"]["STORE"] == 3
    assert data["by_category"]["CORPORATE"] == 3

    # Device types are NOT mixed into category:
    # Desktops: 4 (AST-S-1, AST-C-1, AST-E-1, AST-E-3)
    # Laptops: 3 (AST-S-2, AST-C-2, AST-E-2)
    # Servers: excluded from device_types (0)
    dev_items = {it["name"]: it["count"] for it in data["device_types"]}
    assert dev_items["Desktops"] == 4
    assert dev_items["Laptops"] == 3
    assert "Server" not in dev_items

    # 2. Test via dedicated /api/dashboard/assets-by-category
    res_direct = client.get("/api/dashboard/assets-by-category")
    assert res_direct.status_code == 200
    cat_direct = res_direct.json()
    assert len(cat_direct) == 2
    d_map = {it["name"]: it["count"] for it in cat_direct}
    assert d_map["STORE"] == 3
    assert d_map["CORPORATE"] == 3


def test_dedicated_by_device_type_and_category_endpoint(client: TestClient, db_session: Session):
    """
    Verify that the dedicated /api/dashboard/by-device-type-and-category endpoint
    continues to function correctly for legacy clients.
    """
    now = datetime.now(timezone.utc)
    db_session.query(Asset).delete()
    db_session.commit()

    assets = [
        Asset(asset_id=801, asset_number="A1", source="BIGFIX", devicetype="Desktop", category="STORE", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=802, asset_number="A2", source="BIGFIX", devicetype="desktop", category="store", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=803, asset_number="A3", source="JAMF", devicetype="Laptop", category="CORPORATE", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=804, asset_number="A4", source="JAMF", devicetype="LAPTOP", category="corporate", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=805, asset_number="A5", source="BIGFIX", devicetype="DESKTOP", category="CORPORATE", asset_status="ACTIVE", created_at=now),
    ]
    db_session.add_all(assets)
    db_session.commit()

    res = client.get("/api/dashboard/by-device-type-and-category")
    assert res.status_code == 200
    data = res.json()
    items = data.get("byDeviceTypeAndCategory", data)
    d_map = {it["label"]: it["count"] for it in items}
    assert d_map["STORE-DESKTOPS"] == 2
    assert d_map["CORPORATE-LAPTOPS"] == 2
    assert d_map["CORPORATE-DESKTOPS"] == 1


def test_os_grouping_classification_and_exclusion(client: TestClient, db_session: Session):
    """
    Verify Section 3: Operating System Groups:
    - Classify Windows 11 editions into Windows 11
    - Classify Windows 10 editions into Windows 10
    - Classify macOS versions into Mac
    - Case-insensitive, whitespace handling
    - Exclude other OS (Linux, Ubuntu, Android, etc.), NULL, blank
    - Stable 3 groups with zero counts
    """
    now = datetime.now(timezone.utc)

    # Clear and insert controlled assets
    db_session.query(Asset).delete()
    db_session.commit()

    assets = [
        # Windows 11 variants
        Asset(asset_id=1, asset_number="A1", source="BIGFIX", os_name="Windows 11 Enterprise 23H2", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=2, asset_number="A2", source="JAMF", os_name="  windows 11 pro  ", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=3, asset_number="A3", source="BIGFIX", os_name="WINDOWS 11 EDUCATION", devicetype="Desktop", asset_status="ACTIVE", created_at=now),

        # Windows 10 variants
        Asset(asset_id=4, asset_number="A4", source="BIGFIX", os_name="Windows 10 Enterprise", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=5, asset_number="A5", source="BIGFIX", os_name="windows 10 pro 22h2", devicetype="Desktop", asset_status="ACTIVE", created_at=now),

        # Mac variants
        Asset(asset_id=6, asset_number="A6", source="JAMF", os_name="macOS 15 Sequoia", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=7, asset_number="A7", source="JAMF", os_name="Mac OS X 10.15 Catalina", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=8, asset_number="A8", source="JAMF", os_name="  macos 14.5 sonoma  ", devicetype="Desktop", asset_status="ACTIVE", created_at=now),

        # Excluded OS values
        Asset(asset_id=9, asset_number="A9", source="BIGFIX", os_name="Red Hat Enterprise Linux 9", devicetype="Server", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=10, asset_number="A10", source="BIGFIX", os_name="Ubuntu 22.04 LTS", devicetype="Server", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=11, asset_number="A11", source="BIGFIX", os_name="Android 14", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=12, asset_number="A12", source="BIGFIX", os_name=None, devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=13, asset_number="A13", source="BIGFIX", os_name="   ", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
    ]
    db_session.add_all(assets)
    db_session.commit()

    res = client.get("/api/dashboard/hardware-analysis")
    assert res.status_code == 200
    data = res.json()

    assert data["total_assets"] == 13
    assert data["total_os_assets"] == 8  # 3 Win11 + 2 Win10 + 3 Mac

    os_map = {item["name"]: item["count"] for item in data["operating_systems"]}
    assert os_map["Windows 11"] == 3
    assert os_map["Windows 10"] == 2
    assert os_map["Mac"] == 3

    # Check percentages: 3/8 = 37.5%, 2/8 = 25.0%, 3/8 = 37.5%
    os_pct_map = {item["name"]: item["percentage"] for item in data["operating_systems"]}
    assert os_pct_map["Windows 11"] == 37.5
    assert os_pct_map["Windows 10"] == 25.0
    assert os_pct_map["Mac"] == 37.5

    # Check direct array endpoint /api/dashboard/assets-by-os
    res_os = client.get("/api/dashboard/assets-by-os")
    assert res_os.status_code == 200
    direct_os = res_os.json()
    assert len(direct_os) == 3
    d_map = {it["name"]: it["count"] for it in direct_os}
    assert d_map["Windows 11"] == 3
    assert d_map["Windows 10"] == 2
    assert d_map["Mac"] == 3


def test_device_type_normalization_and_server_exclusion(client: TestClient, db_session: Session):
    """
    Verify Section 4: Hardware Asset Analysis – Device Type:
    - Aggregate Laptops and Desktops
    - Casing and whitespace normalized
    - Server and unrelated types excluded
    - Both categories included even when zero
    """
    now = datetime.now(timezone.utc)

    db_session.query(Asset).delete()
    db_session.commit()

    assets = [
        Asset(asset_id=1, asset_number="D1", source="BIGFIX", devicetype="Desktop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=2, asset_number="D2", source="BIGFIX", devicetype="  desktop  ", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=3, asset_number="D3", source="BIGFIX", devicetype="DESKTOP", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=4, asset_number="L1", source="JAMF", devicetype="Laptop", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=5, asset_number="L2", source="JAMF", devicetype="  LAPTOP  ", asset_status="ACTIVE", created_at=now),
        # Excluded types
        Asset(asset_id=6, asset_number="S1", source="BIGFIX", devicetype="Server", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=7, asset_number="S2", source="BIGFIX", devicetype="SERVER", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=8, asset_number="M1", source="BIGFIX", devicetype="Mobile", asset_status="ACTIVE", created_at=now),
        Asset(asset_id=9, asset_number="N1", source="BIGFIX", devicetype=None, asset_status="ACTIVE", created_at=now),
        Asset(asset_id=10, asset_number="E1", source="BIGFIX", devicetype="   ", asset_status="ACTIVE", created_at=now),
    ]
    db_session.add_all(assets)
    db_session.commit()

    res = client.get("/api/dashboard/hardware-analysis")
    assert res.status_code == 200
    data = res.json()

    assert data["total_assets"] == 10
    assert data["total_device_assets"] == 5  # 3 Desktops + 2 Laptops

    dev_map = {item["name"]: item["count"] for item in data["device_types"]}
    assert dev_map["Desktops"] == 3
    assert dev_map["Laptops"] == 2
    assert "Server" not in dev_map

    # Check percentages: 3/5 = 60.0%, 2/5 = 40.0%
    pct_map = {item["name"]: item["percentage"] for item in data["device_types"]}
    assert pct_map["Desktops"] == 60.0
    assert pct_map["Laptops"] == 40.0

    # Direct array endpoint /api/dashboard/assets-by-device-type
    res_dev = client.get("/api/dashboard/assets-by-device-type")
    assert res_dev.status_code == 200
    direct_dev = res_dev.json()
    assert len(direct_dev) == 2
    d_map = {it["name"]: it["count"] for it in direct_dev}
    assert d_map["Desktops"] == 3
    assert d_map["Laptops"] == 2


def test_zero_count_groups_stable_response(client: TestClient, db_session: Session):
    """
    Verify that when no assets exist:
    - All three OS groups are present with count 0
    - Both device type groups are present with count 0
    - Both category groups (STORE, CORPORATE) are present with count 0
    """
    db_session.query(Asset).delete()
    db_session.commit()

    res = client.get("/api/dashboard/hardware-analysis")
    assert res.status_code == 200
    data = res.json()

    assert data["total_assets"] == 0
    assert data["total_os_assets"] == 0
    assert data["total_device_assets"] == 0
    assert data["total_category_assets"] == 0

    os_map = {item["name"]: item["count"] for item in data["operating_systems"]}
    assert os_map == {"Windows 11": 0, "Windows 10": 0, "Mac": 0}

    dev_map = {item["name"]: item["count"] for item in data["device_types"]}
    assert dev_map == {"Laptops": 0, "Desktops": 0}

    cat_map = {item["name"]: item["count"] for item in data["categories"]}
    assert cat_map == {"STORE": 0, "CORPORATE": 0}
    assert data["by_category"] == {"STORE": 0, "CORPORATE": 0}


def test_eol_distribution_all_four_states(client: TestClient, db_session: Session):
    """
    Verify Section 7: EOL Status Distribution:
    - ACTIVE: > 90 days remaining
    - EOL SOON: 0-90 days remaining, inclusive
    - EXPIRED: before today
    - UNKNOWN: no exact match or no usable date
    Always returns all 4 states in stable order.
    Every asset belongs to exactly one state.
    """
    res = client.get("/api/dashboard/eol-distribution")
    assert res.status_code == 200
    data = res.json()

    assert isinstance(data, list)
    assert len(data) == 4
    statuses = [it["status"] for it in data]
    assert statuses == ["ACTIVE", "EOL SOON", "EXPIRED", "UNKNOWN"]

    # In default seeded database (6 assets):
    # - AST-1001 (Apple MacBook Pro 16): expired (-30 days) -> EXPIRED (1)
    # - AST-1002 (Lenovo ThinkPad T14): in 45 days -> EOL SOON (1)
    # - AST-1003 (Dell PowerEdge R750): in 365 days -> ACTIVE (1)
    # - AST-1004 (Lenovo ThinkPad T14): in 45 days -> EOL SOON (1)
    # - AST-1005 (HP EliteBook 840): no reference -> UNKNOWN (1)
    # - AST-1006 (Dell PowerEdge R750): in 365 days -> ACTIVE (1)
    # Totals: ACTIVE: 2, EOL SOON: 2, EXPIRED: 1, UNKNOWN: 1 = 6 total
    dist_map = {it["status"]: it["count"] for it in data}
    assert dist_map["ACTIVE"] == 2
    assert dist_map["EOL SOON"] == 2
    assert dist_map["EXPIRED"] == 1
    assert dist_map["UNKNOWN"] == 1
    assert sum(dist_map.values()) == 6


def test_eol_exposure_by_hardware_model(client: TestClient):
    """
    Verify Section 8: EOL Exposure by Hardware Model:
    - Excludes ACTIVE hardware models
    - Groups by exact manufacturer and model
    - Sorts by urgency (EXPIRED=0, EOL SOON=1, UNKNOWN=2), days remaining, count
    """
    res = client.get("/api/dashboard/eol-exposure")
    assert res.status_code == 200
    data = res.json()

    assert isinstance(data, list)
    # Non-active models in seeded data:
    # 1. Apple MacBook Pro 16 (EXPIRED, -30 days, count=1)
    # 2. Lenovo ThinkPad T14 (EOL SOON, 45 days, count=2)
    # 3. HP EliteBook 840 (UNKNOWN, count=1)
    assert len(data) == 3
    models = [it["model"] for it in data]
    assert models[0] == "Apple MacBook Pro 16"
    assert models[1] == "Lenovo ThinkPad T14"
    assert models[2] == "HP EliteBook 840"

    assert data[0]["eol_status"] == "EXPIRED"
    assert data[1]["eol_status"] == "EOL SOON"
    assert data[2]["eol_status"] == "UNKNOWN"
    assert data[1]["count"] == 2


def test_department_summary_sorting_highest_first_with_tie_breaker(client: TestClient):
    """
    Verify Section 6: Assets by Department:
    - Aggregate asset counts by assigned employee's department
    - Return highest-count departments first, with stable tie-breaker
    - Prevent duplicate asset counting
    """
    res = client.get("/api/dashboard/department-summary")
    assert res.status_code == 200
    data = res.json()

    assert isinstance(data, list)
    # In seeded data:
    # Unassigned has 3 assets (AST-1003, AST-1004, AST-1006)
    # Engineering has 1 asset (AST-1001)
    # Marketing has 1 asset (AST-1005)
    # Security has 1 asset (AST-1002)
    # First item must be Unassigned (highest count: 3)
    assert data[0]["department"] == "Unassigned"
    assert data[0]["total_assets"] == 3

    # The remaining 3 all have count 1, so tie-breaker is alphabetical: Engineering, Marketing, Security
    assert data[1]["department"] == "Engineering"
    assert data[2]["department"] == "Marketing"
    assert data[3]["department"] == "Security"


def test_redesign_overview_consistency(client: TestClient):
    """
    Verify Section 9 & 10: Redesign Overview endpoint consistency:
    - Accurate database counts for all metrics
    - Zero discrepancies between Assets by Source and Source Summary
    """
    res = client.get("/api/dashboard/redesign-overview")
    assert res.status_code == 200
    data = res.json()

    assert data["kpis"]["total_assets"] == 6
    assert data["kpis"]["active_assets"] == 3
    assert data["kpis"]["review"] == 1
    assert data["kpis"]["in_stock"] == 2

    # Assets by source
    src_map = {it["source"]: it["count"] for it in data["assets_by_source"]}
    assert src_map["BIGFIX"] == 4
    assert src_map["JAMF"] == 2

    # Source summary
    sum_map = {it["source"]: it["total"] for it in data["source_summary"]}
    assert sum_map["BIGFIX"] == 4
    assert sum_map["JAMF"] == 2

    # Hardware analysis included in overview
    hw = data["hardware_analysis"]
    os_map = {it["name"]: it["count"] for it in hw["operating_systems"]}
    assert os_map["Windows 11"] == 2
    assert os_map["Windows 10"] == 1
    assert os_map["Mac"] == 1

    dev_map = {it["name"]: it["count"] for it in hw["device_types"]}
    assert dev_map["Desktops"] == 4
    assert dev_map["Laptops"] == 0

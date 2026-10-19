from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.asset import Asset


def test_hardware_asset_analysis_standard_counts(client: TestClient):
    """
    Verify live database aggregation for the Hardware Asset Analysis card on default seeded database:
    - 6 seeded assets
    - 5 operating systems:
        - 'Windows 11 Pro': 2 (AST-1002, AST-1004)
        - 'macOS 14 Sonoma': 1 (AST-1001)
        - 'Red Hat Enterprise Linux 9': 1 (AST-1003)
        - 'Windows 10 Enterprise': 1 (AST-1005)
        - 'Ubuntu 22.04 LTS': 1 (AST-1006)
    - 2 device types:
        - 'Desktop': 4 (AST-1001, AST-1002, AST-1004, AST-1005)
        - 'Server': 2 (AST-1003, AST-1006)
    """
    response = client.get("/api/dashboard/hardware-analysis")
    assert response.status_code == 200
    data = response.json()

    assert data["total_assets"] == 6
    assert data["total_os_assets"] == 6
    assert data["total_device_assets"] == 6

    # Operating Systems verification
    os_list = data["operating_systems"]
    assert len(os_list) == 5
    os_map = {item["name"]: item["count"] for item in os_list}
    assert os_map["Windows 11 Pro"] == 2
    assert os_map["macOS 14 Sonoma"] == 1
    assert os_map["Red Hat Enterprise Linux 9"] == 1
    assert os_map["Windows 10 Enterprise"] == 1
    assert os_map["Ubuntu 22.04 LTS"] == 1

    # Device Types verification
    dev_list = data["device_types"]
    assert len(dev_list) == 2
    dev_map = {item["name"]: item["count"] for item in dev_list}
    assert dev_map["Desktop"] == 4
    assert dev_map["Server"] == 2

    # Percentage checks
    for item in os_list:
        assert item["percentage"] is not None
        assert 0.0 <= item["percentage"] <= 100.0
        assert item["label"] == item["name"]
        assert item["os_name"] == item["name"]

    for item in dev_list:
        assert item["percentage"] is not None
        assert 0.0 <= item["percentage"] <= 100.0
        assert item["label"] == item["name"]
        assert item["devicetype"] == item["name"]

    # Verify camelCase and map aliases
    assert "operatingSystems" in data
    assert "deviceTypes" in data
    assert "by_os" in data
    assert "by_device" in data
    assert data["by_os"]["Windows 11 Pro"] == 2
    assert data["by_device"]["Desktop"] == 4


def test_exclude_null_empty_and_whitespace_os_and_devicetype(client: TestClient, db_session: Session):
    """
    Verify that records with NULL, empty string, or whitespace-only OS and device-type
    are strictly excluded from the chart collections, and no placeholder categories
    (such as 'Unknown', 'N/A', or '') are fabricated.
    """
    now = datetime.now(timezone.utc)

    # Asset with None OS and whitespace devicetype
    a1 = Asset(
        asset_id=901,
        asset_number="AST-NO-OS-1",
        source="BIGFIX",
        os_name=None,
        devicetype="   ",
        asset_status="ACTIVE",
        created_at=now,
    )
    # Asset with empty string OS and empty string devicetype
    a2 = Asset(
        asset_id=902,
        asset_number="AST-NO-OS-2",
        source="JAMF",
        os_name="",
        devicetype="",
        asset_status="ACTIVE",
        created_at=now,
    )
    # Asset with whitespace-only OS and valid devicetype
    a3 = Asset(
        asset_id=903,
        asset_number="AST-NO-OS-3",
        source="BIGFIX",
        os_name="     ",
        devicetype="Server",
        asset_status="ACTIVE",
        created_at=now,
    )
    # Asset with valid OS and None devicetype
    a4 = Asset(
        asset_id=904,
        asset_number="AST-NO-DEV-4",
        source="BIGFIX",
        os_name="Debian 12",
        devicetype=None,
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add_all([a1, a2, a3, a4])
    db_session.commit()

    res = client.get("/api/dashboard/hardware-analysis")
    assert res.status_code == 200
    data = res.json()

    # Total assets increased by 4
    assert data["total_assets"] == 10

    # OS list: only a4 added ('Debian 12'), a1, a2, a3 must NOT be present
    os_names = [item["name"] for item in data["operating_systems"]]
    assert "Debian 12" in os_names
    for disallowed in ["Unknown", "N/A", "None", "", "   ", "null", "NULL"]:
        assert disallowed not in os_names

    # Check that no item has an empty or whitespace name
    for item in data["operating_systems"]:
        assert item["name"].strip() != ""
        assert item["count"] >= 1

    # Device type list: only a3 added ('Server' count incremented by 1), a1, a2, a4 must NOT add empty/None
    dev_names = [item["name"] for item in data["device_types"]]
    for disallowed in ["Unknown", "N/A", "None", "", "   ", "null", "NULL"]:
        assert disallowed not in dev_names

    for item in data["device_types"]:
        assert item["name"].strip() != ""
        assert item["count"] >= 1

    dev_map = {item["name"]: item["count"] for item in data["device_types"]}
    assert dev_map["Server"] == 3  # 2 original + 1 from a3


def test_whitespace_trimming_and_case_normalization(client: TestClient, db_session: Session):
    """
    Verify grouping rules:
    - OS values with leading/trailing whitespace or case differences group together.
    - Device types with inconsistent whitespace and casing (e.g. '  desktop  ', 'DESKTOP')
      normalize to 'Desktop'.
    """
    now = datetime.now(timezone.utc)

    # Inconsistent OS names that should match 'Ubuntu 22.04 LTS'
    extra1 = Asset(
        asset_id=911,
        asset_number="AST-NORM-1",
        source="BIGFIX",
        os_name="  Ubuntu 22.04 LTS  ",
        devicetype="  desktop  ",
        asset_status="ACTIVE",
        created_at=now,
    )
    extra2 = Asset(
        asset_id=912,
        asset_number="AST-NORM-2",
        source="BIGFIX",
        os_name="ubuntu 22.04 lts",
        devicetype="DESKTOP",
        asset_status="ACTIVE",
        created_at=now,
    )
    extra3 = Asset(
        asset_id=913,
        asset_number="AST-NORM-3",
        source="BIGFIX",
        os_name="UBUNTU 22.04 LTS",
        devicetype="SERVER",
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add_all([extra1, extra2, extra3])
    db_session.commit()

    res = client.get("/api/dashboard/hardware-analysis")
    assert res.status_code == 200
    data = res.json()

    # All Ubuntu variants must be consolidated into one bucket
    os_map = {item["name"]: item["count"] for item in data["operating_systems"]}
    # AST-1006 had 1 + 3 new = 4 total for Ubuntu 22.04 LTS
    ubuntu_count = sum(cnt for name, cnt in os_map.items() if "ubuntu 22.04" in name.lower())
    assert ubuntu_count == 4
    # Ensure there is only 1 Ubuntu 22.04 bucket
    ubuntu_buckets = [name for name in os_map.keys() if "ubuntu 22.04" in name.lower()]
    assert len(ubuntu_buckets) == 1

    # Device types: 'desktop' and 'DESKTOP' grouped into 'Desktop', 'SERVER' into 'Server'
    dev_map = {item["name"]: item["count"] for item in data["device_types"]}
    assert "Desktop" in dev_map
    assert "Server" in dev_map
    assert "desktop" not in dev_map
    assert "DESKTOP" not in dev_map
    assert "SERVER" not in dev_map
    assert dev_map["Desktop"] == 6  # 4 original + 2 new
    assert dev_map["Server"] == 3   # 2 original + 1 new


def test_filtering_by_source_and_scope(client: TestClient):
    """
    Verify filtering support:
    - ?source=BIGFIX: only 4 BigFix assets
        - OS: Apple MacBook Pro 16 (1), Red Hat (1), Windows 10 (1), Ubuntu (1)
        - DeviceType: Desktop (2), Server (2)
    - ?source=JAMF: only 2 Jamf assets
        - OS: Windows 11 Pro (2)
        - DeviceType: Desktop (2)
    """
    # BIGFIX
    res_bf = client.get("/api/dashboard/hardware-analysis?source=BIGFIX")
    assert res_bf.status_code == 200
    data_bf = res_bf.json()
    assert data_bf["total_assets"] == 4
    os_bf = {item["name"]: item["count"] for item in data_bf["operating_systems"]}
    assert "Windows 11 Pro" not in os_bf
    assert os_bf["macOS 14 Sonoma"] == 1
    assert os_bf["Red Hat Enterprise Linux 9"] == 1
    dev_bf = {item["name"]: item["count"] for item in data_bf["device_types"]}
    assert dev_bf["Desktop"] == 2
    assert dev_bf["Server"] == 2

    # JAMF
    res_jf = client.get("/api/dashboard/hardware-analysis?source=JAMF")
    assert res_jf.status_code == 200
    data_jf = res_jf.json()
    assert data_jf["total_assets"] == 2
    os_jf = {item["name"]: item["count"] for item in data_jf["operating_systems"]}
    assert len(os_jf) == 1
    assert os_jf["Windows 11 Pro"] == 2
    dev_jf = {item["name"]: item["count"] for item in data_jf["device_types"]}
    assert len(dev_jf) == 1
    assert dev_jf["Desktop"] == 2


def test_empty_dataset_handling(client: TestClient, db_session: Session):
    """
    Verify that an empty database returns empty collections rather than fabricated categories.
    """
    db_session.query(Asset).delete()
    db_session.commit()

    res = client.get("/api/dashboard/hardware-analysis")
    assert res.status_code == 200
    data = res.json()

    assert data["total_assets"] == 0
    assert data["total_os_assets"] == 0
    assert data["total_device_assets"] == 0
    assert data["operating_systems"] == []
    assert data["device_types"] == []
    assert data["by_os"] == {}
    assert data["by_device"] == {}


def test_direct_array_endpoints_and_aliases(client: TestClient):
    """
    Verify dedicated array endpoints and aliases:
    - /api/dashboard/assets-by-os
    - /api/dashboard/assets-by-device-type
    - /api/assets-by-os
    - /api/assets-by-device-type
    - /api/hardware-analysis
    """
    # 1. /api/dashboard/assets-by-os
    res_os = client.get("/api/dashboard/assets-by-os")
    assert res_os.status_code == 200
    data_os = res_os.json()
    assert isinstance(data_os, list)
    assert len(data_os) == 5
    assert all("name" in item and "count" in item for item in data_os)

    # 2. /api/dashboard/assets-by-device-type
    res_dev = client.get("/api/dashboard/assets-by-device-type")
    assert res_dev.status_code == 200
    data_dev = res_dev.json()
    assert isinstance(data_dev, list)
    assert len(data_dev) == 2
    assert all("name" in item and "count" in item for item in data_dev)

    # 3. Top-level aliases
    res_top = client.get("/api/hardware-analysis")
    assert res_top.status_code == 200
    assert "operating_systems" in res_top.json()

    res_top_os = client.get("/api/assets-by-os")
    assert res_top_os.status_code == 200
    assert isinstance(res_top_os.json(), list)

    res_top_dev = client.get("/api/assets-by-device-type")
    assert res_top_dev.status_code == 200
    assert isinstance(res_top_dev.json(), list)


def test_existing_dashboard_endpoints_remain_unmodified(client: TestClient):
    """
    Ensure existing dashboard endpoints (summary, assets-by-source, ownership, eol, etc.)
    remain completely intact and functioning identically.
    """
    res1 = client.get("/api/dashboard/summary")
    assert res1.status_code == 200
    assert res1.json()["totalAssets"] == 6

    res2 = client.get("/api/dashboard/assets-by-source")
    assert res2.status_code == 200
    assert res2.json()["total_count"] == 6

    res3 = client.get("/api/dashboard/ownership-summary")
    assert res3.status_code == 200
    assert res3.json()["total_count"] == 6

    res4 = client.get("/api/dashboard/operational-status")
    assert res4.status_code == 200
    assert isinstance(res4.json(), list)

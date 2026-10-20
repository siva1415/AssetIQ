from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.models.asset import Asset
from app.models.workday_employee import WorkdayEmployee


def test_select_all_across_multiple_pages(client: TestClient, db_session: Session):
    """
    Verify that bulk assignment with select_all=True resolves and updates
    all matching assets across multiple pagination pages (not just the first 10).
    """
    now = datetime.now(timezone.utc)
    # Seed 35 additional assets so that total assets exceeds several pages (page size 10)
    new_assets = [
        Asset(
            asset_id=1000 + i,
            asset_number=f"AST-MULTI-{i:03d}",
            source="BIGFIX",
            model="Latitude 5520",
            manufacturer="Dell",
            devicetype="Desktop",
            asset_status="REVIEW",
            assigned_username=None,
            remarks=f"Old remark {i}",
            created_at=now,
        )
        for i in range(1, 36)
    ]
    db_session.add_all(new_assets)
    db_session.commit()

    # Total assets in database is now 6 (default) + 35 = 41
    total_assets = db_session.execute(select(func.count(Asset.asset_id))).scalar()
    assert total_assets >= 41

    payload = {
        "select_all": True,
        "assigned_username": "sarahconnor",
        "managed_by": "GROUP",
        "remarks": "Fleet migration assignment",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["matched_count"] == total_assets
    assert data["requested_count"] == total_assets
    assert data["success_count"] == total_assets
    assert data["failure_count"] == 0
    assert len(data["results"]) == total_assets

    # Verify every asset was updated to the specified fields
    all_db_assets = db_session.execute(select(Asset)).scalars().all()
    for asset in all_db_assets:
        assert asset.assigned_username == "sarahconnor"
        assert asset.managed_by == "GROUP"
        assert asset.assignment_type == "MANUAL"
        assert asset.asset_status == "ACTIVE"
        assert asset.remarks == "Fleet migration assignment"


def test_select_all_with_search_and_filters_updates_only_matching_assets(
    client: TestClient, db_session: Session
):
    """
    Verify that filter-based selection updates ONLY assets matching the submitted
    search and filters, while non-matching assets remain completely unaffected.
    """
    now = datetime.now(timezone.utc)
    # Create specific Lenovo ThinkPad laptops and Apple MacBooks
    matching_1 = Asset(
        asset_id=2001,
        asset_number="AST-TARGET-001",
        source="BIGFIX",
        model="ThinkPad T14",
        manufacturer="Lenovo",
        devicetype="Laptop",
        asset_status="REVIEW",
        assigned_username="olduser1",
        remarks="Should be updated",
        created_at=now,
    )
    matching_2 = Asset(
        asset_id=2002,
        asset_number="AST-TARGET-002",
        source="BIGFIX",
        model="ThinkPad X1",
        manufacturer="Lenovo",
        devicetype="Laptop",
        asset_status="REVIEW",
        assigned_username="olduser2",
        remarks="Should be updated",
        created_at=now,
    )
    non_matching = Asset(
        asset_id=2003,
        asset_number="AST-OTHER-003",
        source="JAMF",
        model="MacBook Pro 16",
        manufacturer="Apple",
        devicetype="Laptop",
        asset_status="ACTIVE",
        assigned_username="appleuser",
        remarks="Must NOT change",
        created_at=now,
    )
    db_session.add_all([matching_1, matching_2, non_matching])
    db_session.commit()

    # Bulk assign with search="ThinkPad" and source="BIGFIX"
    payload = {
        "select_all": True,
        "search": "ThinkPad",
        "source": "BIGFIX",
        "assigned_username": "johndoe",
        "managed_by": "INDIVIDUAL",
        "remarks": "Assigned to John Doe",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["matched_count"] == 2
    assert data["success_count"] == 2
    assert data["failure_count"] == 0

    # Matching assets must be updated
    a1 = db_session.get(Asset, 2001)
    assert a1.assigned_username == "johndoe"
    assert a1.managed_by == "INDIVIDUAL"
    assert a1.remarks == "Assigned to John Doe"

    a2 = db_session.get(Asset, 2002)
    assert a2.assigned_username == "johndoe"
    assert a2.managed_by == "INDIVIDUAL"
    assert a2.remarks == "Assigned to John Doe"

    # Non-matching asset MUST NOT be modified
    a3 = db_session.get(Asset, 2003)
    assert a3.assigned_username == "appleuser"
    assert a3.remarks == "Must NOT change"


def test_select_all_large_batch_2000_plus_assets(client: TestClient, db_session: Session):
    """
    Verify handling of large batches with 2,000+ matching assets.
    Ensures safe, fast, non-timing-out chunked execution and accurate counts.
    """
    now = datetime.now(timezone.utc)
    total_count_to_insert = 2050

    # Clean existing assets to test exact 2050 scale
    db_session.query(Asset).delete()
    db_session.commit()

    batch = [
        {
            "asset_id": 10000 + i,
            "asset_number": f"AST-SCALE-{i:05d}",
            "source": "BIGFIX",
            "model": "OptiPlex 7090",
            "manufacturer": "Dell",
            "devicetype": "Desktop",
            "asset_status": "REVIEW",
            "assigned_username": None,
            "remarks": f"Old remark {i}",
            "created_at": now,
        }
        for i in range(1, total_count_to_insert + 1)
    ]
    db_session.bulk_insert_mappings(Asset, batch)
    db_session.commit()

    db_total = db_session.execute(select(func.count(Asset.asset_id))).scalar()
    assert db_total == total_count_to_insert

    # Bulk assign all 2,050 assets to sarahconnor
    payload = {
        "select_all": True,
        "assigned_username": "sarahconnor",
        "managed_by": "GROUP",
        "remarks": "Mass assignment 2050 assets",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["matched_count"] == total_count_to_insert
    assert data["requested_count"] == total_count_to_insert
    assert data["success_count"] == total_count_to_insert
    assert data["failure_count"] == 0
    assert len(data["results"]) == total_count_to_insert

    # Spot check first, middle, and last asset in database
    first = db_session.get(Asset, 10001)
    assert first.assigned_username == "sarahconnor"
    assert first.managed_by == "GROUP"
    assert first.remarks == "Mass assignment 2050 assets"
    assert first.asset_status == "ACTIVE"
    assert first.assignment_type == "MANUAL"

    mid = db_session.get(Asset, 11000)
    assert mid.assigned_username == "sarahconnor"
    assert mid.managed_by == "GROUP"
    assert mid.remarks == "Mass assignment 2050 assets"

    last = db_session.get(Asset, 10000 + total_count_to_insert)
    assert last.assigned_username == "sarahconnor"
    assert last.managed_by == "GROUP"
    assert last.remarks == "Mass assignment 2050 assets"


def test_remarks_clearing_to_sql_null_on_select_all(client: TestClient, db_session: Session):
    """
    Verify mandatory remarks behavior on select_all:
    - If admin leaves remarks blank, update assets.remarks to SQL NULL.
    - Do not retain previous remarks when the request has blank remarks.
    """
    now = datetime.now(timezone.utc)
    # Clear and add 3 assets with existing remarks
    db_session.query(Asset).delete()
    db_session.commit()

    assets = [
        Asset(
            asset_id=3001,
            asset_number="AST-REM-1",
            source="BIGFIX",
            asset_status="REVIEW",
            remarks="Existing critical remark 1",
            created_at=now,
        ),
        Asset(
            asset_id=3002,
            asset_number="AST-REM-2",
            source="BIGFIX",
            asset_status="REVIEW",
            remarks="Existing critical remark 2",
            created_at=now,
        ),
    ]
    db_session.add_all(assets)
    db_session.commit()

    # Step 1: Assign with non-empty remarks
    res1 = client.post(
        "/api/assets/bulk-assign",
        json={
            "select_all": True,
            "assigned_username": "johndoe",
            "managed_by": "INDIVIDUAL",
            "remarks": "Updated to new remark",
        },
    )
    assert res1.status_code == 200
    assert db_session.get(Asset, 3001).remarks == "Updated to new remark"
    assert db_session.get(Asset, 3002).remarks == "Updated to new remark"

    # Step 2: Assign with empty remarks -> must become SQL NULL
    res2 = client.post(
        "/api/assets/bulk-assign",
        json={
            "select_all": True,
            "assigned_username": "sarahconnor",
            "managed_by": "GROUP",
            "remarks": "",  # Empty string
        },
    )
    assert res2.status_code == 200
    db_session.expire_all()
    assert db_session.get(Asset, 3001).remarks is None
    assert db_session.get(Asset, 3002).remarks is None

    # Step 3: Assign with whitespace remarks -> must also become SQL NULL
    # First set a remark
    a1 = db_session.get(Asset, 3001)
    a1.remarks = "Temporary"
    db_session.commit()

    res3 = client.post(
        "/api/assets/bulk-assign",
        json={
            "select_all": True,
            "assigned_username": "johndoe",
            "managed_by": "INDIVIDUAL",
            "remarks": "     ",  # Whitespace only
        },
    )
    assert res3.status_code == 200
    db_session.expire_all()
    assert db_session.get(Asset, 3001).remarks is None


def test_select_all_empty_matches_returns_zero_counts_without_false_success(
    client: TestClient, db_session: Session
):
    """
    Verify response when select-all query matches 0 assets.
    Must return matched_count=0, requested_count=0, success_count=0, failure_count=0
    without falsely reporting success.
    """
    payload = {
        "select_all": True,
        "search": "absolutely_nonexistent_search_query_xyz999",
        "assigned_username": "johndoe",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/bulk-assign", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["matched_count"] == 0
    assert data["requested_count"] == 0
    assert data["success_count"] == 0
    assert data["failure_count"] == 0
    assert data["results"] == []
    assert "0 assets were assigned" in data["message"] or "no assets" in data["message"].lower()


def test_select_all_via_query_parameters_and_nested_filters(
    client: TestClient, db_session: Session
):
    """
    Verify that query parameters and nested filters dictionary work seamlessly.
    """
    now = datetime.now(timezone.utc)
    db_session.query(Asset).delete()
    db_session.commit()

    a1 = Asset(
        asset_id=4001,
        asset_number="AST-PARAM-1",
        source="JAMF",
        asset_status="ACTIVE",
        created_at=now,
    )
    a2 = Asset(
        asset_id=4002,
        asset_number="AST-PARAM-2",
        source="BIGFIX",
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add_all([a1, a2])
    db_session.commit()

    # Query param select_all=true and source=JAMF
    res = client.post(
        "/api/assets/bulk-assign?select_all=true&source=JAMF",
        json={
            "assigned_username": "sarahconnor",
            "managed_by": "GROUP",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success_count"] == 1
    assert data["results"][0]["asset_id"] == 4001

    # Nested filters object
    res_nested = client.post(
        "/api/assets/bulk-assign",
        json={
            "select_all": True,
            "filters": {"source": "BIGFIX"},
            "assigned_username": "johndoe",
            "managed_by": "INDIVIDUAL",
        },
    )
    assert res_nested.status_code == 200
    assert res_nested.json()["success_count"] == 1
    assert res_nested.json()["results"][0]["asset_id"] == 4002

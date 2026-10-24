from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.asset import Asset


def test_get_all_assets_category_populated(client: TestClient, db_session: Session):
    """
    Test that GET /api/assets populates the `category` field with the exact stored value
    from assets.category in the database, and never returns null for categorized assets.
    """
    res = client.get("/api/assets")
    assert res.status_code == 200, res.text
    data = res.json()
    items = data["items"]
    assert len(items) == 6

    # Verify every asset matches the database category
    db_assets = {a.asset_id: a.category for a in db_session.query(Asset).all()}

    for item in items:
        aid = item["asset_id"]
        expected_cat = db_assets[aid]
        assert item["category"] == expected_cat, (
            f"Asset {aid} expected category '{expected_cat}', got '{item['category']}'"
        )
        assert item["category"] in ("STORE", "CORPORATE")


def test_category_across_all_call_variations(client: TestClient, db_session: Session):
    """
    Ensure category is consistently populated across all GET /api/assets variations:
    1. All Assets: /api/assets, /api/assets?scope=all, /api/assets?report=master_hardware
    2. Windows Assets (BigFix): /api/assets?source=BIGFIX, /api/assets?scope=windows
    3. Mac Assets (Jamf): /api/assets?source=JAMF, /api/assets?scope=mac
    4. Asset Ownership: /api/assets?scope=ownership
    """
    endpoints = [
        "/api/assets",
        "/api/assets?scope=all",
        "/api/assets?report=master_hardware",
        "/api/assets?source=BIGFIX",
        "/api/assets?scope=windows",
        "/api/assets?source=JAMF",
        "/api/assets?scope=mac",
        "/api/assets?scope=ownership",
    ]

    db_map = {a.asset_id: a.category for a in db_session.query(Asset).all()}

    for endpoint in endpoints:
        res = client.get(endpoint)
        assert res.status_code == 200, f"Failed on {endpoint}: {res.text}"
        data = res.json()
        items = data["items"]
        assert len(items) > 0, f"No items returned for {endpoint}"

        for item in items:
            aid = item["asset_id"]
            expected = db_map[aid]
            assert item["category"] == expected, (
                f"Endpoint {endpoint}: Asset {aid} category '{item['category']}' != expected '{expected}'"
            )
            assert item["category"] is not None


def test_category_in_single_asset_detail(client: TestClient, db_session: Session):
    """
    Ensure GET /api/assets/{asset_id} also returns category from assets.category.
    """
    res1 = client.get("/api/assets/1")
    assert res1.status_code == 200
    assert res1.json()["category"] == "CORPORATE"

    res2 = client.get("/api/assets/2")
    assert res2.status_code == 200
    assert res2.json()["category"] == "STORE"


def test_category_actual_stored_value_preservation(client: TestClient, db_session: Session):
    """
    Verify that actual stored values are returned without hardcoding, inferring,
    or replacing null with mock data.
    """
    now = datetime.now(timezone.utc)

    # Asset with null category
    null_asset = Asset(
        asset_id=701,
        asset_number="AST-CAT-NULL-701",
        source="BIGFIX",
        devicetype="Desktop",
        category=None,
        asset_status="ACTIVE",
        created_at=now,
    )
    # Asset with custom category
    custom_asset = Asset(
        asset_id=702,
        asset_number="AST-CAT-CUSTOM-702",
        source="BIGFIX",
        devicetype="Desktop",
        category="WAREHOUSE",
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add_all([null_asset, custom_asset])
    db_session.commit()

    # Query via list
    res = client.get("/api/assets?search=AST-CAT-")
    assert res.status_code == 200
    items = {it["asset_id"]: it["category"] for it in res.json()["items"]}

    # Stored None should be returned as None (not replaced with mock string)
    assert items[701] is None

    # Stored "WAREHOUSE" should be returned exactly
    assert items[702] == "WAREHOUSE"


def test_category_filtering_and_sorting(client: TestClient, db_session: Session):
    """
    Test filtering by category and sorting by category.
    """
    # Filter by category=STORE
    res_store = client.get("/api/assets?category=STORE")
    assert res_store.status_code == 200
    store_items = res_store.json()["items"]
    assert len(store_items) == 3
    for it in store_items:
        assert it["category"] == "STORE"

    # Filter by category=store (case-insensitive)
    res_store_lower = client.get("/api/assets?category=store")
    assert res_store_lower.status_code == 200
    assert len(res_store_lower.json()["items"]) == 3

    # Filter by category=CORPORATE
    res_corp = client.get("/api/assets?category=CORPORATE")
    assert res_corp.status_code == 200
    corp_items = res_corp.json()["items"]
    assert len(corp_items) == 3
    for it in corp_items:
        assert it["category"] == "CORPORATE"

    # Sort by category asc
    res_sort_asc = client.get("/api/assets?sort_by=category&sort_order=asc")
    assert res_sort_asc.status_code == 200
    cats_asc = [it["category"] for it in res_sort_asc.json()["items"]]
    assert cats_asc == sorted(cats_asc)

    # Sort by category desc
    res_sort_desc = client.get("/api/assets?sort_by=category&sort_order=desc")
    assert res_sort_desc.status_code == 200
    cats_desc = [it["category"] for it in res_sort_desc.json()["items"]]
    assert cats_desc == sorted(cats_desc, reverse=True)

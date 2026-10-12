from fastapi.testclient import TestClient


def test_list_assets_pagination_and_field_mappings(client: TestClient):
    """
    Test pagination metadata (total, page, page_size, total_pages)
    and verify corrected field mappings:
    - AssetID / assetId / asset_id
    - DeviceType / deviceType / devicetype
    - macAddress / macaddress
    - lastDiscoveryDate / lastreporttime
    - eolStatus / eol_status
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

    # Check first item field mappings
    item = data["items"][0]
    assert item["asset_id"] == 1
    assert item["assetId"] == 1
    assert item["AssetID"] == 1
    assert item["devicetype"] == "Desktop"
    assert item["deviceType"] == "Desktop"
    assert item["DeviceType"] == "Desktop"
    assert item["macaddress"] == "3c:22:fb:01:23:45"
    assert item["macAddress"] == "3c:22:fb:01:23:45"
    assert item["lastreporttime"] is not None
    assert item["lastDiscoveryDate"] is not None
    assert item["LastDiscoveryDate"] is not None
    assert item["eol_status"] == "Expired"
    assert item["eolStatus"] == "Expired"
    assert item["eol_date"] is not None
    assert item["eolDate"] is not None


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

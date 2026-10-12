from fastapi.testclient import TestClient


def test_health_endpoint_structure(client: TestClient):
    """
    Test GET /health returns consistent schema attributes.
    """
    response = client.get("/health")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data
    assert "app_name" in data
    assert "environment" in data
    assert "database_status" in data
    assert "database_message" in data
    assert "timestamp" in data


def test_api_health_alias(client: TestClient):
    """
    Test GET /api/health returns matching response.
    """
    response = client.get("/api/health")
    assert response.status_code in (200, 503)
    data = response.json()
    assert data["app_name"] == "AssetIQ"

from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.services.eol_service import EolService


def test_eol_calculation_boundaries():
    """
    Test EOL lifecycle mathematical boundaries:
    - Missing matching EOL date: Unknown
    - EOL date before today: Expired
    - EOL date from today through the next warning threshold, inclusive: Nearing EOL
    - EOL date beyond the threshold: Active
    """
    today = date(2026, 1, 1)
    warning_days = 90

    # 1. Missing date -> Unknown
    status, days = EolService.calculate_eol(None, warning_days=warning_days, as_of_date=today)
    assert status == "Unknown"
    assert days is None

    # 2. 1 day in the past -> Expired
    status, days = EolService.calculate_eol(
        today - timedelta(days=1), warning_days=warning_days, as_of_date=today
    )
    assert status == "Expired"
    assert days == -1

    # 3. 100 days in the past -> Expired
    status, days = EolService.calculate_eol(
        today - timedelta(days=100), warning_days=warning_days, as_of_date=today
    )
    assert status == "Expired"
    assert days == -100

    # 4. Exactly today -> Nearing EOL (0 days remaining)
    status, days = EolService.calculate_eol(today, warning_days=warning_days, as_of_date=today)
    assert status == "Nearing EOL"
    assert days == 0

    # 5. Warning threshold boundary: exactly 90 days from today -> Nearing EOL (inclusive)
    status, days = EolService.calculate_eol(
        today + timedelta(days=90), warning_days=warning_days, as_of_date=today
    )
    assert status == "Nearing EOL"
    assert days == 90

    # 6. 1 day past warning threshold: 91 days from today -> Active
    status, days = EolService.calculate_eol(
        today + timedelta(days=91), warning_days=warning_days, as_of_date=today
    )
    assert status == "Active"
    assert days == 91

    # 7. Far future -> Active
    status, days = EolService.calculate_eol(
        today + timedelta(days=365), warning_days=warning_days, as_of_date=today
    )
    assert status == "Active"
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
    assert statuses["AST-1001"] == "Expired"  # MacBook Pro 16 expired 30 days ago
    assert statuses["AST-1002"] == "Nearing EOL"  # ThinkPad T14 in 45 days
    assert statuses["AST-1003"] == "Active"  # PowerEdge R750 in 365 days
    assert statuses["AST-1005"] == "Unknown"  # EliteBook 840 has no reference


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

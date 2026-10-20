import io
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee

EXPECTED_18_REPORT_HEADERS = [
    "Asset",
    "Source",
    "DeviceType",
    "Manufacturer",
    "Model",
    "SerialNumber",
    "Operating System",
    "MacAddress",
    "Computer ID",
    "Asset Status",
    "EOL Expiry Date",
    "EOL Status",
    "EOL Days Remaining",
    "Managed By",
    "Assigned UserID",
    "Assigned UserName",
    "Department",
    "Remarks",
]

EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _read_xlsx(content: bytes):
    wb = load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    assert len(rows) >= 1, "XLSX must have at least one header row"
    header = [str(col) if col is not None else "" for col in rows[0]]
    data_rows = rows[1:]
    return header, data_rows


def test_reports_card_counts_match_database(client: TestClient):
    """
    Verify the Reports page card counts obtained via API:
    - Master Hardware: 6
    - Warranty Compliance Issues: 3
    - BigFix Assets: 4
    - Jamf Assets: 2
    - In-Stock Inventory: 2
    - Need-Validation Assets: 1
    Verifies that /api/reports/summary, /api/dashboard/reports-summary,
    and /api/assets/reports-summary all return identical accurate counts.
    """
    for endpoint in ["/api/reports/summary", "/api/dashboard/reports-summary", "/api/assets/reports-summary"]:
        res = client.get(endpoint)
        assert res.status_code == 200, f"Failed on {endpoint}"
        data = res.json()

        assert data["master_hardware"] == 6
        assert data["warranty_compliance_issues"] == 3
        assert data["bigfix_assets"] == 4
        assert data["jamf_assets"] == 2
        assert data["in_stock_inventory"] == 2
        assert data["need_validation_assets"] == 1

        card_map = {c["id"]: c["count"] for c in data.get("cards", [])}
        assert card_map["master_hardware"] == 6
        assert card_map["warranty_compliance_issues"] == 3
        assert card_map["bigfix_assets"] == 4
        assert card_map["jamf_assets"] == 2
        assert card_map["in_stock_inventory"] == 2
        assert card_map["need_validation_assets"] == 1


def test_dashboard_and_assets_summary_contain_reports_summary(client: TestClient):
    """
    Verify that general summary endpoints (/api/dashboard/summary, /api/assets/summary)
    embed reports_summary with all six card counts.
    """
    for endpoint in ["/api/dashboard/summary", "/api/assets/summary"]:
        res = client.get(endpoint)
        assert res.status_code == 200
        data = res.json()

        assert "reports_summary" in data or "reportsSummary" in data
        rep = data.get("reports_summary") or data.get("reportsSummary")
        assert rep["master_hardware"] == 6
        assert rep["warranty_compliance_issues"] == 3
        assert rep["bigfix_assets"] == 4
        assert rep["jamf_assets"] == 2
        assert rep["in_stock_inventory"] == 2
        assert rep["need_validation_assets"] == 1


def test_export_master_hardware_xlsx(client: TestClient):
    """
    Verify Master Hardware export:
    - Status code is 200
    - Content-Type is application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    - Genuine XLSX workbook
    - Exact 18 columns in exact order
    - All 6 fleet assets returned
    - Default filename matches assetiq_master_hardware_*.xlsx
    """
    res = client.get("/api/assets/export?report=master_hardware")
    assert res.status_code == 200
    assert EXCEL_MIME in res.headers["content-type"]
    assert "attachment" in res.headers["content-disposition"]
    assert "assetiq_master_hardware_" in res.headers["content-disposition"]
    assert res.headers["content-disposition"].endswith('.xlsx"')

    header, data_rows = _read_xlsx(res.content)
    assert header == EXPECTED_18_REPORT_HEADERS
    assert len(data_rows) == 6


def test_export_all_six_report_cards_xlsx(client: TestClient):
    """
    Verify that each of the six report cards exports the exact expected records in XLSX:
    1. Master Hardware: 6
    2. Warranty Compliance Issues: 3 (AST-1001, AST-1002, AST-1004)
    3. BigFix Assets: 4 (AST-1001, AST-1003, AST-1005, AST-1006)
    4. Jamf Assets: 2 (AST-1002, AST-1004)
    5. In-Stock Inventory: 2 (AST-1003, AST-1006)
    6. Need-Validation Assets: 1 (AST-1002)
    """
    # 1. Master Hardware
    r1 = client.get("/api/assets/export?report=master_hardware")
    assert r1.status_code == 200
    _, rows1 = _read_xlsx(r1.content)
    assert len(rows1) == 6

    # 2. Warranty Compliance Issues (expired or nearing EOL threshold)
    r2 = client.get("/api/assets/export?report=warranty_compliance_issues")
    assert r2.status_code == 200
    assert "warranty_compliance_issues" in r2.headers["content-disposition"]
    header2, rows2 = _read_xlsx(r2.content)
    assert header2 == EXPECTED_18_REPORT_HEADERS
    assert len(rows2) == 3
    assets2 = {r[0] for r in rows2}
    assert assets2 == {"AST-1001", "AST-1002", "AST-1004"}

    # 3. BigFix Assets
    r3 = client.get("/api/assets/export?report=bigfix_assets")
    assert r3.status_code == 200
    assert "bigfix_assets" in r3.headers["content-disposition"]
    _, rows3 = _read_xlsx(r3.content)
    assert len(rows3) == 4
    for r in rows3:
        assert r[1] == "BIGFIX"

    # 4. Jamf Assets
    r4 = client.get("/api/assets/export?report=jamf_assets")
    assert r4.status_code == 200
    assert "jamf_assets" in r4.headers["content-disposition"]
    _, rows4 = _read_xlsx(r4.content)
    assert len(rows4) == 2
    for r in rows4:
        assert r[1] == "JAMF"

    # 5. In-Stock Inventory
    r5 = client.get("/api/assets/export?report=in_stock_inventory")
    assert r5.status_code == 200
    assert "in_stock_inventory" in r5.headers["content-disposition"]
    _, rows5 = _read_xlsx(r5.content)
    assert len(rows5) == 2
    for r in rows5:
        assert str(r[9]).upper() == "IN STOCK"

    # 6. Need-Validation Assets
    r6 = client.get("/api/assets/export?report=need_validation_assets")
    assert r6.status_code == 200
    assert "need_validation_assets" in r6.headers["content-disposition"]
    _, rows6 = _read_xlsx(r6.content)
    assert len(rows6) == 1
    assert rows6[0][0] == "AST-1002"
    assert str(rows6[0][9]).upper() == "REVIEW"


def test_export_fields_mapping_and_remarks(client: TestClient):
    """
    Verify complete field mapping, Workday employee details, and Remarks column:
    - AST-1001: Developer laptop remarks, matched with John Doe
    - AST-1002: Security check remarks, matched with Sarah Connor
    - AST-1004: Blank remarks, unmapped employee
    - AST-1003: Unassigned asset, blank employee details
    """
    res = client.get("/api/assets/export?report=master_hardware")
    assert res.status_code == 200
    header, rows = _read_xlsx(res.content)
    row_map = {r[0]: r for r in rows}

    ast1 = row_map["AST-1001"]
    assert ast1[0] == "AST-1001"
    assert ast1[1] == "BIGFIX"
    assert ast1[2] == "Desktop"
    assert ast1[3] == "Apple"
    assert ast1[4] == "MacBook Pro 16"
    assert ast1[5] == "SN-APP-001"
    assert ast1[6] == "macOS 14 Sonoma"
    assert ast1[7] == "3c:22:fb:01:23:45"
    assert ast1[9] == "ACTIVE"
    assert ast1[11] == "EXPIRED"
    assert int(ast1[12]) < 0
    assert ast1[13] == "INDIVIDUAL"
    assert ast1[14].upper() == "JOHNDOE"
    assert ast1[15] == "John Doe"
    assert ast1[16] == "Engineering"
    assert ast1[17] == "Primary developer laptop"

    ast2 = row_map["AST-1002"]
    assert ast2[15] == "Sarah Connor"
    assert ast2[16] == "Security"
    assert ast2[17] == "Needs security check"

    ast4 = row_map["AST-1004"]
    assert ast4[14] == "admin_local"
    assert (ast4[15] or "") == ""
    assert (ast4[16] or "") == ""
    assert (ast4[17] or "") == ""


def test_export_format_xlsx_and_route_aliases(client: TestClient):
    """
    Verify alternative routes and format parameters:
    - /api/assets/export?format=xlsx
    - /api/assets/export.xlsx
    - /api/assets/export/xlsx
    - /api/assets/xlsx
    - custom filename in query param
    """
    # 1. ?format=xlsx on all assets
    res1 = client.get("/api/assets/export?format=xlsx")
    assert res1.status_code == 200
    assert EXCEL_MIME in res1.headers["content-type"]
    h1, r1 = _read_xlsx(res1.content)
    assert h1 == EXPECTED_18_REPORT_HEADERS
    assert len(r1) == 6

    # 2. /export.xlsx
    res2 = client.get("/api/assets/export.xlsx")
    assert res2.status_code == 200
    assert EXCEL_MIME in res2.headers["content-type"]

    # 3. /export/xlsx
    res3 = client.get("/api/assets/export/xlsx")
    assert res3.status_code == 200
    assert EXCEL_MIME in res3.headers["content-type"]

    # 4. /xlsx
    res4 = client.get("/api/assets/xlsx")
    assert res4.status_code == 200
    assert EXCEL_MIME in res4.headers["content-type"]

    # 5. custom filename
    res5 = client.get("/api/assets/export?report=bigfix_assets&filename=custom_bigfix.xlsx")
    assert res5.status_code == 200
    assert 'filename="custom_bigfix.xlsx"' in res5.headers["content-disposition"]


def test_export_combined_filters_in_reports(client: TestClient):
    """
    Verify report scope combined with dynamic search and filters:
    - report=warranty_compliance_issues
    - source=JAMF
    Only AST-1002 and AST-1004 qualify (MacBook Pro is BIGFIX).
    """
    res = client.get("/api/assets/export?report=warranty_compliance_issues&source=JAMF")
    assert res.status_code == 200
    _, rows = _read_xlsx(res.content)
    assert len(rows) == 2
    for r in rows:
        assert r[1] == "JAMF"


def test_export_reports_large_dataset_50000_records(client: TestClient, db_session: Session):
    """
    Verify large dataset export:
    - Populates 50,000 asset records in PostgreSQL/SQLite
    - GET /api/assets/export?report=master_hardware&search=AST-50K-
    - Validates all 50,000 records are exported without truncation
    - Validates correct headers and spot-checks row content
    """
    now = datetime.now(timezone.utc)
    base_id = 500000
    bulk_count = 50000
    batch = []
    for i in range(bulk_count):
        batch.append(
            Asset(
                asset_id=base_id + i,
                asset_number=f"AST-50K-{i:06d}",
                serial_number=f"SN-50K-{i:06d}",
                source="BIGFIX" if i % 2 == 0 else "JAMF",
                manufacturer="Dell",
                model="PowerEdge R750",
                os_name="Red Hat Enterprise Linux 9",
                macaddress=f"00:50:56:01:{i//256:02x}:{i%256:02x}",
                devicetype="Server",
                managed_by="GROUP",
                assigned_username="johndoe" if i % 2 == 0 else None,
                asset_status="ACTIVE",
                assignment_type="AUTO",
                remarks=f"Bulk asset index {i}",
                created_at=now,
            )
        )
    db_session.bulk_save_objects(batch)
    db_session.commit()

    # Query master hardware report with search
    res = client.get("/api/assets/export?report=master_hardware&search=AST-50K-")
    assert res.status_code == 200
    assert EXCEL_MIME in res.headers["content-type"]

    header, rows = _read_xlsx(res.content)
    assert header == EXPECTED_18_REPORT_HEADERS
    assert len(rows) == 50000, f"Expected 50000 records, got {len(rows)}"

    # Spot check first row
    first = rows[0]
    assert first[0] == "AST-50K-000000"
    assert first[1] == "BIGFIX"
    assert first[14] == "johndoe"
    assert first[15] == "John Doe"
    assert first[16] == "Engineering"
    assert first[17] == "Bulk asset index 0"

    # Spot check last row
    last = rows[-1]
    assert last[0] == "AST-50K-049999"
    assert last[1] == "JAMF"
    assert (last[14] or "") == ""
    assert (last[15] or "") == ""
    assert last[17] == "Bulk asset index 49999"

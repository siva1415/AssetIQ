import csv
import io
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.workday_employee import WorkdayEmployee
from app.models.device_eol_reference import DeviceEolReference

EXPECTED_HEADERS = [
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
]


def _parse_csv(text: str):
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    assert len(rows) >= 1, "CSV must have at least a header row"
    return rows[0], rows[1:]


def test_export_all_assets_columns_and_order(client: TestClient):
    """
    Verify All Assets scope export:
    - Status code is 200
    - Content-Type is text/csv
    - Headers match exact 17 columns in exact order
    - Default filename contains assetiq_all_assets
    """
    response = client.get("/api/assets/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert "assetiq_all_assets" in response.headers["content-disposition"]

    header, data_rows = _parse_csv(response.text)
    assert header == EXPECTED_HEADERS
    # 6 seeded assets in conftest
    assert len(data_rows) == 6


def test_export_four_page_scopes(client: TestClient):
    """
    Verify each of the 4 page scopes:
    - All Assets (scope=all): all sources (BIGFIX + JAMF)
    - Windows Assets (scope=windows): BIGFIX only
    - Mac Assets (scope=mac): JAMF only
    - Asset Ownership (scope=ownership): all assets
    """
    # 1. All Assets
    res_all = client.get("/api/assets/export?scope=all")
    assert res_all.status_code == 200
    assert "assetiq_all_assets" in res_all.headers["content-disposition"]
    _, rows_all = _parse_csv(res_all.text)
    sources_all = {r[1] for r in rows_all}
    assert "BIGFIX" in sources_all
    assert "JAMF" in sources_all

    # 2. Windows Assets (BigFix)
    res_win = client.get("/api/assets/export?scope=windows")
    assert res_win.status_code == 200
    assert "assetiq_windows_assets" in res_win.headers["content-disposition"]
    _, rows_win = _parse_csv(res_win.text)
    assert len(rows_win) > 0
    for r in rows_win:
        assert r[1] == "BIGFIX", f"Expected BIGFIX in Windows scope, got {r[1]}"

    # 3. Mac Assets (Jamf)
    res_mac = client.get("/api/assets/export?scope=mac")
    assert res_mac.status_code == 200
    assert "assetiq_mac_assets" in res_mac.headers["content-disposition"]
    _, rows_mac = _parse_csv(res_mac.text)
    assert len(rows_mac) > 0
    for r in rows_mac:
        assert r[1] == "JAMF", f"Expected JAMF in Mac scope, got {r[1]}"

    # 4. Asset Ownership
    res_own = client.get("/api/assets/export?scope=ownership")
    assert res_own.status_code == 200
    assert "assetiq_asset_ownership" in res_own.headers["content-disposition"]
    _, rows_own = _parse_csv(res_own.text)
    assert len(rows_own) == len(rows_all)


def test_export_matched_unmatched_and_unassigned_users(client: TestClient):
    """
    Verify Workday user mapping in CSV:
    - Matched user: Assigned UserID='JOHNDOE', Assigned UserName='John Doe', Department='Engineering'
    - Unmatched user (admin_local): Assigned UserID='admin_local', Assigned UserName='', Department=''
    - Unassigned asset (asset 3): Assigned UserID='', Assigned UserName='', Department=''
    """
    response = client.get("/api/assets/export?scope=all")
    assert response.status_code == 200
    _, rows = _parse_csv(response.text)
    row_by_asset = {r[0]: r for r in rows}

    # AST-1001 assigned to JOHNDOE (matched)
    ast1 = row_by_asset["AST-1001"]
    assert ast1[14].upper() == "JOHNDOE"  # Assigned UserID
    assert ast1[15] == "John Doe"         # Assigned UserName
    assert ast1[16] == "Engineering"      # Department

    # AST-1004 assigned to admin_local (unmatched in Workday)
    ast4 = row_by_asset["AST-1004"]
    assert ast4[14] == "admin_local"      # Assigned UserID
    assert ast4[15] == ""                 # Blank UserName
    assert ast4[16] == ""                 # Blank Department

    # AST-1003 is unassigned
    ast3 = row_by_asset["AST-1003"]
    assert ast3[14] == ""                 # Blank UserID
    assert ast3[15] == ""                 # Blank UserName
    assert ast3[16] == ""                 # Blank Department


def test_export_eol_calculations_and_expiry(client: TestClient):
    """
    Verify EOL dates, negative days remaining, and status values:
    - Expired EOL: AST-1001 (Apple MacBook Pro 16) has negative days remaining, EOL Status='EXPIRED'
    - EOL Soon: AST-1002 (Lenovo ThinkPad T14) has 0-90 days, EOL Status='EOL SOON'
    - Active EOL: AST-1003 (Dell PowerEdge R750) has >90 days, EOL Status='ACTIVE'
    - Unknown EOL: AST-1005 (HP EliteBook 840) has no EOL reference, EOL Status='UNKNOWN', blanks for date & days
    """
    response = client.get("/api/assets/export?scope=all")
    assert response.status_code == 200
    _, rows = _parse_csv(response.text)
    row_by_asset = {r[0]: r for r in rows}

    # Expired
    ast1 = row_by_asset["AST-1001"]
    assert ast1[11] == "EXPIRED"
    assert int(ast1[12]) < 0  # Negative days preserved
    assert len(ast1[10]) == 10  # YYYY-MM-DD

    # EOL Soon
    ast2 = row_by_asset["AST-1002"]
    assert ast2[11] == "EOL SOON"
    assert 0 <= int(ast2[12]) <= 90

    # Active
    ast3 = row_by_asset["AST-1003"]
    assert ast3[11] == "ACTIVE"
    assert int(ast3[12]) > 90

    # Unknown
    ast5 = row_by_asset["AST-1005"]
    assert ast5[11] == "UNKNOWN"
    assert ast5[10] == ""  # Blank date
    assert ast5[12] == ""  # Blank days


def test_export_combined_filters_and_search(client: TestClient):
    """
    Verify combining search with filters:
    - devicetype=Desktop
    - asset_status=ACTIVE
    - source=BIGFIX
    - search=AST-1001
    """
    res = client.get("/api/assets/export?devicetype=Desktop&asset_status=ACTIVE&source=BIGFIX&search=AST-1001")
    assert res.status_code == 200
    _, rows = _parse_csv(res.text)
    assert len(rows) == 1
    assert rows[0][0] == "AST-1001"
    assert rows[0][1] == "BIGFIX"
    assert rows[0][2] == "Desktop"
    assert rows[0][9] == "ACTIVE"


def test_export_search_by_workday_employee_name(client: TestClient):
    """
    Verify global search matches Workday employee full name (e.g. 'Sarah Connor').
    """
    res = client.get("/api/assets/export?search=Sarah+Connor")
    assert res.status_code == 200
    _, rows = _parse_csv(res.text)
    assert len(rows) == 1
    assert rows[0][0] == "AST-1002"
    assert rows[0][15] == "Sarah Connor"


def test_export_empty_results(client: TestClient):
    """
    Verify query matching no records returns HTTP 200 with header row and 0 data rows.
    """
    res = client.get("/api/assets/export?search=nonexistent_asset_search_99999")
    assert res.status_code == 200
    header, rows = _parse_csv(res.text)
    assert header == EXPECTED_HEADERS
    assert len(rows) == 0


def test_export_special_characters_escaping_and_unicode(client: TestClient, db_session: Session):
    """
    Verify RFC 4180 CSV escaping for values with commas, quotes, line breaks, and Unicode.
    """
    now = datetime.now(timezone.utc)
    special_asset = Asset(
        asset_id=8888,
        asset_number='AST-"SPECIAL",8888',
        serial_number='SN,COMMA,"QUOTE"',
        source="BIGFIX",
        manufacturer="Acme, Inc.",
        model="Model with, comma and \"quotes\"\nand newline",
        os_name="Windows 11 – Über Edition 日本語 🚀",
        macaddress="00:11:22:33:44:55",
        devicetype="Desktop",
        managed_by="GROUP",
        assigned_username=None,
        asset_status="ACTIVE",
        created_at=now,
    )
    db_session.add(special_asset)
    db_session.commit()

    res = client.get("/api/assets/export?search=8888")
    assert res.status_code == 200

    header, rows = _parse_csv(res.text)
    assert header == EXPECTED_HEADERS
    assert len(rows) == 1
    row = rows[0]

    assert row[0] == 'AST-"SPECIAL",8888'
    assert row[3] == "Acme, Inc."
    assert row[4] == 'Model with, comma and "quotes"\nand newline'
    assert row[6] == "Windows 11 – Über Edition 日本語 🚀"


def test_export_custom_filename_parameter(client: TestClient):
    """
    Verify custom filename query parameter is reflected in Content-Disposition.
    """
    res = client.get("/api/assets/export?filename=custom_q3_report.csv")
    assert res.status_code == 200
    assert 'filename="custom_q3_report.csv"' in res.headers["content-disposition"]


def test_export_large_dataset_10000_records(client: TestClient, db_session: Session):
    """
    Verify export performance and completeness with 10,000+ matching records:
    - Generates 10,000 records
    - Verifies all 10,000 rows are returned without truncation
    - Verifies headers and data row count
    """
    now = datetime.now(timezone.utc)
    # Bulk insert 10,000 assets
    batch = []
    base_id = 100000
    for i in range(10000):
        batch.append(
            Asset(
                asset_id=base_id + i,
                asset_number=f"AST-BULK-{i:05d}",
                serial_number=f"SN-BULK-{i:05d}",
                source="BIGFIX" if i % 2 == 0 else "JAMF",
                manufacturer="Dell",
                model="PowerEdge R750",
                os_name="Linux",
                macaddress=f"00:50:56:00:{i//256:02x}:{i%256:02x}",
                devicetype="Server",
                managed_by="GROUP",
                assigned_username="johndoe" if i % 2 == 0 else None,
                asset_status="ACTIVE",
                assignment_type="MANUAL",
                created_at=now,
            )
        )
    db_session.bulk_save_objects(batch)
    db_session.commit()

    # Query all bulk assets
    res = client.get("/api/assets/export?search=AST-BULK-")
    assert res.status_code == 200
    header, rows = _parse_csv(res.text)
    assert header == EXPECTED_HEADERS
    assert len(rows) == 10000, f"Expected 10000 rows, got {len(rows)}"

    # Spot check first and last rows
    assert rows[0][0] == "AST-BULK-00000"
    assert rows[0][1] == "BIGFIX"
    assert rows[0][14] == "johndoe"
    assert rows[0][15] == "John Doe"

    assert rows[-1][0] == "AST-BULK-09999"
    assert rows[-1][1] == "JAMF"
    assert rows[-1][14] == ""

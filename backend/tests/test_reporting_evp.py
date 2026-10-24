from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.workday_employee import WorkdayEmployee
from app.repositories.employee_repository import EmployeeRepository
from app.services.asset_service import AssetService


def test_build_executive_list_filtering(db_session: Session):
    """
    1. Query workday_employees where department = 'Executive Committee'.
    Identify employees whose job_title starts with 'EVP -' or 'President -',
    and collect their user_id and full_name.
    """
    now = datetime.now(timezone.utc)
    # Valid EVPs / Presidents in Executive Committee
    exec1 = WorkdayEmployee(
        employee_id=101,
        user_id="evp_ops",
        full_name="Elena Vance",
        department="Executive Committee",
        job_title="EVP - Operations",
        employee_status="Active",
        created_at=now,
    )
    exec2 = WorkdayEmployee(
        employee_id=102,
        user_id="pres_tech",
        full_name="Peter Theron",
        department="  Executive Committee  ",  # Whitespace safety
        job_title="President - Technology",
        employee_status="Active",
        created_at=now,
    )
    # Excluded: in Executive Committee, but job title does not start with EVP - or President -
    exec_ceo = WorkdayEmployee(
        employee_id=103,
        user_id="ceo_bill",
        full_name="Bill Gates",
        department="Executive Committee",
        job_title="Chief Executive Officer",
        employee_status="Active",
        created_at=now,
    )
    exec_vp = WorkdayEmployee(
        employee_id=104,
        user_id="vp_mark",
        full_name="Mark Sloan",
        department="Executive Committee",
        job_title="VP - Retail Operations",
        employee_status="Active",
        created_at=now,
    )
    # Excluded: job title starts with EVP -, but department is NOT Executive Committee
    exec_wrong_dept = WorkdayEmployee(
        employee_id=105,
        user_id="evp_sales_wrong",
        full_name="Walter White",
        department="Sales & Marketing",
        job_title="EVP - Global Sales",
        employee_status="Active",
        created_at=now,
    )
    db_session.add_all([exec1, exec2, exec_ceo, exec_vp, exec_wrong_dept])
    db_session.commit()

    lookup = EmployeeRepository.get_executive_committee_lookup(db_session)
    assert "evp_ops" in lookup
    assert lookup["evp_ops"]["full_name"] == "Elena Vance"
    assert lookup["evp_ops"]["user_id"] == "evp_ops"
    assert lookup["evp_ops"]["job_title"] == "EVP - Operations"

    assert "pres_tech" in lookup
    assert lookup["pres_tech"]["full_name"] == "Peter Theron"
    assert lookup["pres_tech"]["user_id"] == "pres_tech"
    assert lookup["pres_tech"]["job_title"] == "President - Technology"

    # Excluded employees
    assert "ceo_bill" not in lookup
    assert "vp_mark" not in lookup
    assert "evp_sales_wrong" not in lookup


def test_reporting_evp_direct_level_1(client: TestClient, db_session: Session):
    """
    Assigned user reports directly to an EVP at manager_level_1_user_name.
    """
    now = datetime.now(timezone.utc)
    evp = WorkdayEmployee(
        employee_id=201,
        user_id="evp_finance",
        full_name="Fiona Gallagher",
        department="Executive Committee",
        job_title="EVP - Chief Financial Officer",
        employee_status="Active",
        created_at=now,
    )
    emp = WorkdayEmployee(
        employee_id=202,
        user_id="analyst_bob",
        full_name="Bob Builder",
        department="Finance",
        job_title="Financial Analyst",
        employee_status="Active",
        manager_level_1_user_name="evp_finance",
        created_at=now,
    )
    asset = Asset(
        asset_id=2001,
        asset_number="AST-2001",
        serial_number="SN-2001",
        assigned_username="analyst_bob",
        source="BIGFIX",
        devicetype="Laptop",
        category="CORPORATE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([evp, emp, asset])
    db_session.commit()

    res = client.get("/api/assets/2001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == {
        "full_name": "Fiona Gallagher",
        "user_id": "evp_finance",
        "job_title": "EVP - Chief Financial Officer",
    }
    assert data["matched_employee"]["reporting_evp"] == {
        "full_name": "Fiona Gallagher",
        "user_id": "evp_finance",
        "job_title": "EVP - Chief Financial Officer",
    }


def test_reporting_evp_deep_hierarchy_level_5(client: TestClient, db_session: Session):
    """
    Assigned user reports through intermediate managers, reaching EVP at manager_level_5_user_name.
    """
    now = datetime.now(timezone.utc)
    evp = WorkdayEmployee(
        employee_id=301,
        user_id="pres_stores",
        full_name="Patricia Star",
        department="Executive Committee",
        job_title="President - Retail Operations",
        employee_status="Active",
        created_at=now,
    )
    emp = WorkdayEmployee(
        employee_id=302,
        user_id="store_associate",
        full_name="Sam Smith",
        department="Retail",
        job_title="Store Lead",
        employee_status="Active",
        manager_level_1_user_name="shift_mgr",
        manager_level_2_user_name="store_mgr",
        manager_level_3_user_name="district_mgr",
        manager_level_4_user_name="regional_vp",
        manager_level_5_user_name="pres_stores",
        created_at=now,
    )
    asset = Asset(
        asset_id=3001,
        asset_number="AST-3001",
        serial_number="SN-3001",
        assigned_username="store_associate",
        source="JAMF",
        devicetype="Desktop",
        category="STORE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([evp, emp, asset])
    db_session.commit()

    res = client.get("/api/assets/3001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == {
        "full_name": "Patricia Star",
        "user_id": "pres_stores",
        "job_title": "President - Retail Operations",
    }


def test_reporting_evp_special_case_ea_to_ceo(client: TestClient, db_session: Session):
    """
    Special case: If assigned user's job_title is 'Executive Assistant to the CEO', return '-'.
    """
    now = datetime.now(timezone.utc)
    evp = WorkdayEmployee(
        employee_id=401,
        user_id="evp_admin",
        full_name="Arthur Pendelton",
        department="Executive Committee",
        job_title="EVP - Chief of Staff",
        employee_status="Active",
        created_at=now,
    )
    emp_ea = WorkdayEmployee(
        employee_id=402,
        user_id="ea_user",
        full_name="Emma Assistant",
        department="Executive Committee",
        job_title="  Executive Assistant to the CEO  ",  # with spaces and exact match
        employee_status="Active",
        manager_level_1_user_name="evp_admin",
        created_at=now,
    )
    asset = Asset(
        asset_id=4001,
        asset_number="AST-4001",
        assigned_username="ea_user",
        source="BIGFIX",
        devicetype="Laptop",
        category="CORPORATE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([evp, emp_ea, asset])
    db_session.commit()

    res = client.get("/api/assets/4001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == "-"


def test_reporting_evp_special_case_ceo(client: TestClient, db_session: Session):
    """
    Special case: If assigned user's job_title is 'Chief Executive Officer', return '-'.
    """
    now = datetime.now(timezone.utc)
    evp = WorkdayEmployee(
        employee_id=501,
        user_id="pres_exec",
        full_name="Paula President",
        department="Executive Committee",
        job_title="President - Enterprise Operations",
        employee_status="Active",
        created_at=now,
    )
    ceo = WorkdayEmployee(
        employee_id=502,
        user_id="ceo_user",
        full_name="Charles CEO",
        department="Executive Committee",
        job_title="Chief Executive Officer",
        employee_status="Active",
        manager_level_1_user_name="pres_exec",
        created_at=now,
    )
    asset = Asset(
        asset_id=5001,
        asset_number="AST-5001",
        assigned_username="ceo_user",
        source="BIGFIX",
        devicetype="Laptop",
        category="CORPORATE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([evp, ceo, asset])
    db_session.commit()

    res = client.get("/api/assets/5001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == "-"


def test_reporting_evp_no_executive_found_returns_dash(client: TestClient, db_session: Session):
    """
    If no matching EVP or President is found, return '-'.
    """
    now = datetime.now(timezone.utc)
    emp = WorkdayEmployee(
        employee_id=601,
        user_id="standalone_user",
        full_name="Stan Lee",
        department="Research",
        job_title="Research Scientist",
        employee_status="Active",
        manager_level_1_user_name="research_lead",
        manager_level_2_user_name="lab_director",
        created_at=now,
    )
    asset = Asset(
        asset_id=6001,
        asset_number="AST-6001",
        assigned_username="standalone_user",
        source="BIGFIX",
        devicetype="Desktop",
        category="CORPORATE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([emp, asset])
    db_session.commit()

    res = client.get("/api/assets/6001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == "-"


def test_reporting_evp_unassigned_asset_returns_dash(client: TestClient, db_session: Session):
    """
    Unassigned assets (assigned_username is None or empty) return '-'.
    """
    now = datetime.now(timezone.utc)
    asset = Asset(
        asset_id=7001,
        asset_number="AST-7001",
        assigned_username=None,
        source="BIGFIX",
        devicetype="Laptop",
        category="STORE",
        asset_status="INSTOCK",
        managed_by="GROUP",
        created_at=now,
    )
    db_session.add(asset)
    db_session.commit()

    res = client.get("/api/assets/7001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == "-"


def test_reporting_evp_whitespace_and_case_insensitivity(client: TestClient, db_session: Session):
    """
    Handles whitespace, mixed casing, and null manager levels safely.
    """
    now = datetime.now(timezone.utc)
    evp = WorkdayEmployee(
        employee_id=801,
        user_id="EvP_ClOuD",
        full_name="Claudia Cloud",
        department="  Executive Committee  ",
        job_title="  EVP - Infrastructure  ",
        employee_status="Active",
        created_at=now,
    )
    emp = WorkdayEmployee(
        employee_id=802,
        user_id="dev_user",
        full_name="Dave Developer",
        department="Engineering",
        job_title="Software Developer",
        employee_status="Active",
        manager_level_1_user_name=None,
        manager_level_2_user_name="   ",
        manager_level_3_user_name="  evp_cloud  ",  # lowercase + whitespace matching mixed case evp
        created_at=now,
    )
    asset = Asset(
        asset_id=8001,
        asset_number="AST-8001",
        assigned_username="dev_user",
        source="BIGFIX",
        devicetype="Laptop",
        category="CORPORATE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([evp, emp, asset])
    db_session.commit()

    res = client.get("/api/assets/8001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == {
        "full_name": "Claudia Cloud",
        "user_id": "EvP_ClOuD",
        "job_title": "EVP - Infrastructure",
    }


def test_reporting_evp_reassignment_updates_value(client: TestClient, db_session: Session):
    """
    Reassigning an asset via POST /api/assets/{id}/assign immediately updates reporting_evp.
    """
    now = datetime.now(timezone.utc)
    evp = WorkdayEmployee(
        employee_id=901,
        user_id="evp_hr",
        full_name="Hannah Reyes",
        department="Executive Committee",
        job_title="EVP - People & Culture",
        employee_status="Active",
        created_at=now,
    )
    emp_without_evp = WorkdayEmployee(
        employee_id=902,
        user_id="unlinked_staff",
        full_name="Ursula Staff",
        department="Operations",
        job_title="Coordinator",
        employee_status="Active",
        created_at=now,
    )
    emp_with_evp = WorkdayEmployee(
        employee_id=903,
        user_id="linked_staff",
        full_name="Liam Linked",
        department="People",
        job_title="HR Specialist",
        employee_status="Active",
        manager_level_1_user_name="evp_hr",
        created_at=now,
    )
    asset = Asset(
        asset_id=9001,
        asset_number="AST-9001",
        assigned_username="unlinked_staff",
        source="JAMF",
        devicetype="Laptop",
        category="CORPORATE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([evp, emp_without_evp, emp_with_evp, asset])
    db_session.commit()

    # Before reassignment: reporting_evp is "-"
    res_before = client.get("/api/assets/9001")
    assert res_before.status_code == 200
    assert res_before.json()["reporting_evp"] == "-"

    # Reassign asset to linked_staff
    res_assign = client.post(
        "/api/assets/9001/assign",
        json={
            "asset_id": 9001,
            "user_id": "linked_staff",
            "managed_by": "INDIVIDUAL",
        },
        headers={"X-User-Id": "admin"},
    )
    assert res_assign.status_code == 200
    data_assigned = res_assign.json()
    assert data_assigned["reporting_evp"] == {
        "full_name": "Hannah Reyes",
        "user_id": "evp_hr",
        "job_title": "EVP - People & Culture",
    }


def test_reporting_evp_job_title_edge_cases(client: TestClient, db_session: Session):
    """
    Test job_title whitespace trimming, President prefix matching, and safe handling.
    """
    now = datetime.now(timezone.utc)
    evp = WorkdayEmployee(
        employee_id=1001,
        user_id="pres_supply",
        full_name="Sarah Supply",
        department="Executive Committee",
        job_title="  President - Global Supply Chain  ",
        employee_status="Active",
        created_at=now,
    )
    emp = WorkdayEmployee(
        employee_id=1002,
        user_id="procurement_buyer",
        full_name="Peter Procurement",
        department="Supply Chain",
        job_title="Buyer II",
        employee_status="Active",
        manager_level_1_user_name="pres_supply",
        created_at=now,
    )
    asset = Asset(
        asset_id=10001,
        asset_number="AST-10001",
        assigned_username="procurement_buyer",
        source="BIGFIX",
        devicetype="Laptop",
        category="CORPORATE",
        asset_status="ACTIVE",
        managed_by="INDIVIDUAL",
        created_at=now,
    )
    db_session.add_all([evp, emp, asset])
    db_session.commit()

    res = client.get("/api/assets/10001")
    assert res.status_code == 200
    data = res.json()
    assert data["reporting_evp"] == {
        "full_name": "Sarah Supply",
        "user_id": "pres_supply",
        "job_title": "President - Global Supply Chain",
    }
    assert data["matched_employee"]["reporting_evp"]["job_title"] == "President - Global Supply Chain"

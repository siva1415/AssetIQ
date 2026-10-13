from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_database
from app.db.base import Base
from app.main import app
from app.models.asset import Asset
from app.models.admin_user import AdminUser
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee

# In-memory SQLite engine configured for unit and integration testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Creates SQLite schema once for test execution.
    """
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def db_session() -> Session:
    """
    Yields an isolated database session with sample seeded records for each test.
    """
    session = TestingSessionLocal()
    # Clean up existing rows
    session.query(Asset).delete()
    session.query(AdminUser).delete()
    session.query(WorkdayEmployee).delete()
    session.query(DeviceEolReference).delete()
    session.commit()

    today = date.today()
    now_utc = datetime.now(timezone.utc)

    # 1. Seed Workday Employees
    emp1 = WorkdayEmployee(
        employee_id=1,
        user_id="johndoe",
        full_name="John Doe",
        email_work="john.doe@enterprise.com",
        department="Engineering",
        division="Product Dev",
        job_title="Senior Systems Engineer",
        employee_status="Active",
        manager_name="Jane Manager",
        manager_user_name="janemanager",
        location="San Francisco, CA",
        hire_date=date(2021, 5, 10),
        created_at=now_utc,
    )
    emp2 = WorkdayEmployee(
        employee_id=2,
        user_id="sarahconnor",
        full_name="Sarah Connor",
        email_work="sarah.connor@enterprise.com",
        department="Security",
        division="Cyber Defense",
        job_title="Lead Security Analyst",
        employee_status="Active",
        manager_name="Robert Boss",
        manager_user_name="robertboss",
        location="Austin, TX",
        hire_date=date(2019, 8, 1),
        created_at=now_utc,
    )
    emp3 = WorkdayEmployee(
        employee_id=3,
        user_id="alexturner",
        full_name="Alex Turner",
        email_work="alex.turner@enterprise.com",
        department="Marketing",
        division="Growth",
        job_title="Growth Specialist",
        employee_status="Terminated",  # Inactive employee to test that matching still works
        hire_date=date(2022, 1, 15),
        created_at=now_utc,
    )
    session.add_all([emp1, emp2, emp3])

    # 2. Seed Admin Users
    admin1 = AdminUser(
        admin_user_id="johndoe",
        created_at=now_utc,
    )
    session.add(admin1)

    # 3. Seed EOL Reference Table
    eol1 = DeviceEolReference(
        eol_id=1,
        manufacturer="Apple",
        model="MacBook Pro 16",
        eol_date=today - timedelta(days=30),
        reference_source="Apple Hardware Lifecycle Matrix",
        created_at=now_utc,
    )
    eol2 = DeviceEolReference(
        eol_id=2,
        manufacturer="Lenovo",
        model="ThinkPad T14",
        eol_date=today + timedelta(days=45),
        reference_source="Lenovo Enterprise EOS Guide",
        created_at=now_utc,
    )
    eol3 = DeviceEolReference(
        eol_id=3,
        manufacturer="Dell",
        model="PowerEdge R750",
        eol_date=today + timedelta(days=365),
        reference_source="Dell EMC Lifecycle Portal",
        created_at=now_utc,
    )
    session.add_all([eol1, eol2, eol3])

    # 4. Seed Assets (using migrated uppercase asset_status compliant with assets_asset_status_check)
    asset1 = Asset(
        asset_id=1,
        asset_number="AST-1001",
        serial_number="SN-APP-001",
        source="BIGFIX",
        manufacturer="Apple",
        model="MacBook Pro 16",
        os_name="macOS 14 Sonoma",
        macaddress="3c:22:fb:01:23:45",
        devicetype="Desktop",
        managed_by="INDIVIDUAL",
        assigned_username="  JOHNDOE  ",  # tests uppercase + whitespace
        asset_status="ACTIVE",
        assignment_type="AUTO",
        remarks="Primary developer laptop",
        lastreporttime=now_utc,
        created_at=now_utc,
    )
    asset2 = Asset(
        asset_id=2,
        asset_number="AST-1002",
        serial_number="SN-LEN-002",
        source="JAMF",
        manufacturer="Lenovo",
        model="ThinkPad T14",
        os_name="Windows 11 Pro",
        macaddress="50:7b:9d:22:44:90",
        devicetype="Desktop",
        managed_by="INDIVIDUAL",
        assigned_username="sarahconnor",
        asset_status="REVIEW",
        assignment_type="MANUAL",
        remarks="Needs security check",
        lastreporttime=now_utc,
        created_at=now_utc,
    )
    asset3 = Asset(
        asset_id=3,
        asset_number="AST-1003",
        serial_number="SN-DEL-003",
        source="BIGFIX",
        manufacturer="Dell",
        model="PowerEdge R750",
        os_name="Red Hat Enterprise Linux 9",
        macaddress="00:1e:67:d8:a4:20",
        devicetype="Server",
        managed_by="GROUP",
        assigned_username=None,  # Unassigned
        asset_status="IN STOCK",
        assignment_type=None,
        remarks=None,
        lastreporttime=now_utc,
        created_at=now_utc,
    )
    asset4 = Asset(
        asset_id=4,
        asset_number="AST-1004",
        serial_number="SN-LEN-004",
        source="JAMF",
        manufacturer="Lenovo",
        model="ThinkPad T14",
        os_name="Windows 11 Pro",
        macaddress="50:7b:9d:88:12:33",
        devicetype="Desktop",
        managed_by="INDIVIDUAL",
        assigned_username="admin_local",  # Not in Workday
        asset_status="ACTIVE",
        assignment_type="MANUAL",
        remarks=None,
        lastreporttime=now_utc,
        created_at=now_utc,
    )
    asset5 = Asset(
        asset_id=5,
        asset_number="AST-1005",
        serial_number="SN-HP-005",
        source="BIGFIX",
        manufacturer="HP",
        model="EliteBook 840",  # No EOL reference -> Unknown
        os_name="Windows 10 Enterprise",
        macaddress=None,
        devicetype="Desktop",
        managed_by="INDIVIDUAL",
        assigned_username="alexturner",  # Inactive employee in Workday
        asset_status="ACTIVE",
        assignment_type="AUTO",
        remarks=None,
        lastreporttime=now_utc,
        created_at=now_utc,
    )
    asset6 = Asset(
        asset_id=6,
        asset_number="AST-1006",
        serial_number="SN-DEL-006",
        source="BIGFIX",
        manufacturer="Dell",
        model="PowerEdge R750",
        os_name="Ubuntu 22.04 LTS",
        macaddress=None,
        devicetype="Server",
        managed_by="GROUP",
        assigned_username="   ",  # blank string -> Unassigned
        asset_status="IN STOCK",
        assignment_type=None,
        remarks=None,
        lastreporttime=now_utc,
        created_at=now_utc,
    )
    session.add_all([asset1, asset2, asset3, asset4, asset5, asset6])
    session.commit()

    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> TestClient:
    """
    TestClient with overridden database dependency.
    """
    def override_get_database():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_database] = override_get_database
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

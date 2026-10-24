import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.migrations import migrate_asset_status_records
from app.models.asset import Asset


def test_assign_asset_success(client: TestClient):
    """
    Verify Assign Asset User saves all 5 required fields:
    - managed_by = 'INDIVIDUAL'
    - assigned_username = 'sarahconnor' (workday user_id)
    - asset_status = 'ACTIVE' (exact uppercase default)
    - assignment_type = 'MANUAL'
    - remarks = 'Assigned for engineering project'
    """
    payload = {
        "user_id": "sarahconnor",
        "managed_by": "INDIVIDUAL",
        "remarks": "Assigned for engineering project",
    }
    # Assign AST-1003 (which was unassigned)
    response = client.post("/api/assets/3/assign", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["asset_id"] == 3
    assert data["managed_by"] == "INDIVIDUAL"
    assert data["assigned_username"] == "sarahconnor"
    assert data["asset_status"] == "ACTIVE"
    assert data["assignment_type"] == "MANUAL"
    assert data["remarks"] == "Assigned for engineering project"

    # Verify persistence by reading back the asset
    get_res = client.get("/api/assets/3")
    assert get_res.status_code == 200
    persisted = get_res.json()
    assert persisted["managed_by"] == "INDIVIDUAL"
    assert persisted["assigned_username"] == "sarahconnor"
    assert persisted["asset_status"] == "ACTIVE"
    assert persisted["assignment_type"] == "MANUAL"
    assert persisted["remarks"] == "Assigned for engineering project"
    assert persisted["workday_status"] == "Matched Workday employee"


def test_reassign_asset_updates_in_place_without_duplicate(client: TestClient):
    """
    Verify Reassign Asset User updates existing record in place, replaces user,
    preserves total asset count, and preserves existing remarks when omitted.
    """
    # 1. Initial assignment with remarks
    client.post(
        "/api/assets/3/assign",
        json={
            "user_id": "sarahconnor",
            "managed_by": "INDIVIDUAL",
            "remarks": "Assigned for engineering project",
        },
    )

    initial_assets = client.get("/api/assets").json()
    initial_count = initial_assets["total_items"]

    # 2. Reassign asset 3 from sarahconnor to johndoe without providing remarks
    payload = {
        "username": "johndoe",
        "managed_by": "INDIVIDUAL",
    }
    reassign_res = client.post("/api/assets/3/assign", json=payload)
    assert reassign_res.status_code == 200
    reassigned = reassign_res.json()
    assert reassigned["assigned_username"] == "johndoe"
    assert reassigned["assignment_type"] == "MANUAL"
    assert reassigned["asset_status"] == "ACTIVE"
    # Preserves existing remarks when omitted
    assert reassigned["remarks"] == "Assigned for engineering project"

    # Total assets count in DB must remain unchanged (no duplicate created)
    after_assets = client.get("/api/assets").json()
    assert after_assets["total_items"] == initial_count


def test_assign_asset_post_all_valid_statuses(client: TestClient):
    """
    Verify POST endpoint accepts and persists all four exact uppercase status values:
    ACTIVE, REVIEW, IN STOCK, RETIRED
    """
    valid_statuses = ["ACTIVE", "REVIEW", "IN STOCK", "RETIRED"]

    for status_val in valid_statuses:
        payload = {
            "user_id": "sarahconnor",
            "managed_by": "INDIVIDUAL",
            "asset_status": status_val,
            "remarks": f"Testing POST with status {status_val}",
        }
        response = client.post("/api/assets/3/assign", json=payload)
        assert response.status_code == 200, f"Failed for {status_val}: {response.text}"
        data = response.json()
        assert data["asset_status"] == status_val
        assert data["assignment_type"] == "MANUAL"

        # Verify persisted via GET
        persisted = client.get("/api/assets/3").json()
        assert persisted["asset_status"] == status_val


def test_assign_asset_put_all_valid_statuses(client: TestClient):
    """
    Verify PUT endpoint accepts and persists all four exact uppercase status values:
    ACTIVE, REVIEW, IN STOCK, RETIRED
    """
    valid_statuses = ["ACTIVE", "REVIEW", "IN STOCK", "RETIRED"]

    for status_val in valid_statuses:
        payload = {
            "user_id": "johndoe",
            "managed_by": "GROUP",
            "asset_status": status_val,
            "remarks": f"Testing PUT with status {status_val}",
        }
        # Test PUT /{asset_id}/assign
        response = client.put("/api/assets/3/assign", json=payload)
        assert response.status_code == 200, f"PUT /assign failed for {status_val}: {response.text}"
        assert response.json()["asset_status"] == status_val

        # Verify persisted
        persisted = client.get("/api/assets/3").json()
        assert persisted["asset_status"] == status_val

        # Also test PUT /{asset_id}
        put_direct = client.put("/api/assets/3", json=payload)
        assert put_direct.status_code == 200, f"PUT direct failed for {status_val}: {put_direct.text}"
        assert put_direct.json()["asset_status"] == status_val


def test_assign_asset_rejects_unsupported_statuses_with_422(client: TestClient):
    """
    Verify POST and PUT reject unsupported values with HTTP 422:
    - lowercase values ('active')
    - legacy values ('NEED VALIDATION', 'Need Validation', 'InStock', 'Retired')
    - invalid strings ('PENDING', 'DECOMMISSIONED')
    - confirms values are NOT silently converted to 'ACTIVE'
    """
    invalid_statuses = [
        "active",
        "Active",
        "NEED VALIDATION",
        "Need Validation",
        "need validation",
        "InStock",
        "instock",
        "Retired",
        "retired",
        "PENDING",
        "DECOMMISSIONED",
        "INVALID",
    ]

    for bad_status in invalid_statuses:
        # POST test
        post_res = client.post(
            "/api/assets/3/assign",
            json={
                "user_id": "sarahconnor",
                "managed_by": "INDIVIDUAL",
                "asset_status": bad_status,
            },
        )
        assert post_res.status_code == 422, f"POST did not reject '{bad_status}' with 422: {post_res.status_code}"
        assert "validation failed" in post_res.json()["detail"].lower() or "asset_status" in str(post_res.json())

        # PUT test
        put_res = client.put(
            "/api/assets/3/assign",
            json={
                "user_id": "sarahconnor",
                "managed_by": "INDIVIDUAL",
                "asset_status": bad_status,
            },
        )
        assert put_res.status_code == 422, f"PUT did not reject '{bad_status}' with 422: {put_res.status_code}"

        # Collection POST test
        coll_res = client.post(
            "/api/assets/assign",
            json={
                "asset_id": 3,
                "user_id": "sarahconnor",
                "managed_by": "INDIVIDUAL",
                "asset_status": bad_status,
            },
        )
        assert coll_res.status_code == 422, f"Collection POST did not reject '{bad_status}' with 422"


def test_assign_asset_collection_endpoint_post_and_put(client: TestClient):
    """
    Verify assignment via collection endpoints POST and PUT /api/assets/assign
    persists exact uppercase asset_status.
    """
    # POST /api/assets/assign
    post_res = client.post(
        "/api/assets/assign",
        json={
            "asset_id": 6,
            "user_id": "sarahconnor",
            "managed_by": "INDIVIDUAL",
            "asset_status": "RETIRED",
            "remarks": "Decommissioned to stock",
        },
    )
    assert post_res.status_code == 200
    assert post_res.json()["asset_id"] == 6
    assert post_res.json()["asset_status"] == "RETIRED"
    assert post_res.json()["assignment_type"] == "MANUAL"

    # PUT /api/assets/assign
    put_res = client.put(
        "/api/assets/assign",
        json={
            "asset_id": 6,
            "user_id": "johndoe",
            "managed_by": "GROUP",
            "asset_status": "ACTIVE",
            "remarks": "Re-activated",
        },
    )
    assert put_res.status_code == 200
    assert put_res.json()["asset_status"] == "ACTIVE"
    assert put_res.json()["assigned_username"] == "johndoe"


def test_assign_asset_group_management(client: TestClient):
    """
    Verify managed_by can be set to 'GROUP' and lowercase is normalized.
    """
    payload = {
        "user_id": "johndoe",
        "managed_by": "group",
        "remarks": "Assigned to DevOps Group",
    }
    response = client.post("/api/assets/4/assign", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["managed_by"] == "GROUP"
    assert data["assigned_username"] == "johndoe"
    assert data["assignment_type"] == "MANUAL"
    assert data["asset_status"] == "ACTIVE"


def test_assign_asset_invalid_managed_by(client: TestClient):
    """
    Verify managed_by validation rejects values other than 'INDIVIDUAL' or 'GROUP'.
    """
    payload = {
        "user_id": "johndoe",
        "managed_by": "INVALID_SCOPE",
    }
    response = client.post("/api/assets/1/assign", json=payload)
    assert response.status_code == 400
    assert "INDIVIDUAL" in response.json()["detail"]


def test_assign_asset_nonexistent_employee(client: TestClient):
    """
    Verify assigning a non-existent Workday employee returns HTTP 400.
    """
    payload = {
        "user_id": "ghost_user_does_not_exist",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/1/assign", json=payload)
    assert response.status_code == 400
    assert "not found" in response.json()["detail"]


def test_assign_asset_terminated_employee_rejected(client: TestClient):
    """
    Verify assigning an inactive/terminated Workday employee violates assignment policy.
    """
    payload = {
        "user_id": "alexturner",  # Inactive employee in test database
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/1/assign", json=payload)
    assert response.status_code == 400
    assert "cannot be assigned" in response.json()["detail"]


def test_assign_asset_nonexistent_asset(client: TestClient):
    """
    Verify attempting to assign to a non-existent asset ID returns HTTP 404.
    """
    payload = {
        "user_id": "johndoe",
        "managed_by": "INDIVIDUAL",
    }
    response = client.post("/api/assets/999999/assign", json=payload)
    assert response.status_code == 404


def test_database_check_constraint_enforcement(db_session: Session):
    """
    Verify PostgreSQL / SQLite assets_asset_status_check constraint directly at the database layer.
    - All 4 exact uppercase statuses succeed
    - NULL values succeed
    - Non-conforming values ('Active', 'INVALID') fail with IntegrityError
    """
    # 1. Allowed statuses
    for valid in ["ACTIVE", "REVIEW", "IN STOCK", "RETIRED"]:
        db_session.query(Asset).filter(Asset.asset_id == 1).update({"asset_status": valid})
        db_session.commit()
        db_val = db_session.get(Asset, 1).asset_status
        assert db_val == valid

    # 2. NULL status
    db_session.query(Asset).filter(Asset.asset_id == 1).update({"asset_status": None})
    db_session.commit()
    assert db_session.get(Asset, 1).asset_status is None

    # 3. Disallowed value fails check constraint
    with pytest.raises(IntegrityError):
        db_session.query(Asset).filter(Asset.asset_id == 1).update({"asset_status": "Active"})
        db_session.commit()
    db_session.rollback()

    with pytest.raises(IntegrityError):
        db_session.query(Asset).filter(Asset.asset_id == 1).update({"asset_status": "NEED VALIDATION"})
        db_session.commit()
    db_session.rollback()

    with pytest.raises(IntegrityError):
        db_session.query(Asset).filter(Asset.asset_id == 1).update({"asset_status": "DISALLOWED_VAL"})
        db_session.commit()
    db_session.rollback()


def test_migration_of_legacy_records():
    """
    Verify migrate_asset_status_records safely migrates legacy values:
    Active -> ACTIVE, Need Validation / NEED VALIDATION -> REVIEW, InStock -> IN STOCK, Retired -> RETIRED,
    preserves NULL values, and explicitly raises on unexpected values without silent overwrite.
    """
    from sqlalchemy import create_engine, Column, Integer, String
    from sqlalchemy.orm import declarative_base, sessionmaker

    TmpBase = declarative_base()

    class LegacyAsset(TmpBase):
        __tablename__ = "assets"
        asset_id = Column(Integer, primary_key=True)
        asset_status = Column(String(30), nullable=True)

    engine = create_engine("sqlite:///:memory:")
    TmpBase.metadata.create_all(engine)
    SessionTest = sessionmaker(bind=engine)
    session = SessionTest()

    # Seed legacy values
    session.add(LegacyAsset(asset_id=1, asset_status="Active"))
    session.add(LegacyAsset(asset_id=2, asset_status="Need Validation"))
    session.add(LegacyAsset(asset_id=3, asset_status="InStock"))
    session.add(LegacyAsset(asset_id=4, asset_status="Retired"))
    session.add(LegacyAsset(asset_id=5, asset_status="ACTIVE"))
    session.add(LegacyAsset(asset_id=6, asset_status=None))
    session.add(LegacyAsset(asset_id=7, asset_status="NEED VALIDATION"))
    session.commit()

    count, ids = migrate_asset_status_records(session)
    assert count == 5
    assert set(ids) == {1, 2, 3, 4, 7}

    # Verify updated values
    assert session.get(LegacyAsset, 1).asset_status == "ACTIVE"
    assert session.get(LegacyAsset, 2).asset_status == "REVIEW"
    assert session.get(LegacyAsset, 3).asset_status == "IN STOCK"
    assert session.get(LegacyAsset, 4).asset_status == "RETIRED"
    assert session.get(LegacyAsset, 5).asset_status == "ACTIVE"
    assert session.get(LegacyAsset, 6).asset_status is None
    assert session.get(LegacyAsset, 7).asset_status == "REVIEW"

    # Test that unexpected status raises ValueError and rolls back without silent overwrite
    session.add(LegacyAsset(asset_id=8, asset_status="CORRUPTED_VALUE"))
    session.commit()

    with pytest.raises(ValueError) as excinfo:
        migrate_asset_status_records(session)
    assert "CORRUPTED_VALUE" in str(excinfo.value)


# =========================================================================
# Asset Ownership Details: Assign and Reassign User Tests
# =========================================================================

def test_assign_user_from_ownership_details_unassigned_asset(client: TestClient):
    """
    Requirement 1-6: Assign user to an unassigned asset from Asset Ownership details.
    - Uses asset_number ('AST-1003') or ID (3).
    - Accepts selected Workday employee user_id ('sarahconnor').
    - Updates ownership info, sets status to 'ACTIVE', assignment_type to 'MANUAL'.
    - Returns updated asset including asset_number, user_id, and user_full_name.
    """
    payload = {
        "user_id": "sarahconnor",
        "managed_by": "INDIVIDUAL",
        "remarks": "Assigned via Asset Ownership details popup",
    }
    # Test assignment via asset_number in path
    response = client.post("/api/assets/AST-1003/assign", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["asset_number"] == "AST-1003"
    assert data["user_id"] == "sarahconnor"
    assert data["userId"] == "sarahconnor"
    assert data["user_full_name"] == "Sarah Connor"
    assert data["userFullName"] == "Sarah Connor"
    assert data["assigned_username"] == "sarahconnor"
    assert data["asset_status"] == "ACTIVE"
    assert data["assignment_type"] == "MANUAL"
    assert data["managed_by"] == "INDIVIDUAL"
    assert data["remarks"] == "Assigned via Asset Ownership details popup"
    assert data["workday_status"] == "Matched Workday employee"
    assert data["matched_employee"]["full_name"] == "Sarah Connor"

    # Verify persisted in database
    get_res = client.get("/api/assets/AST-1003")
    assert get_res.status_code == 200
    persisted = get_res.json()
    assert persisted["assigned_username"] == "sarahconnor"
    assert persisted["user_id"] == "sarahconnor"
    assert persisted["user_full_name"] == "Sarah Connor"
    assert persisted["asset_status"] == "ACTIVE"


def test_reassign_user_from_ownership_details_assigned_asset(client: TestClient):
    """
    Requirement 4-6: Reassign an already assigned asset to another Workday user.
    - Asset 1 initially assigned to 'johndoe'.
    - Reassigned to 'sarahconnor'.
    - Replaces assigned user in place without duplicates.
    - Returns updated asset including asset_number, user_id, and user_full_name.
    """
    # Verify initial assignment
    initial = client.get("/api/assets/1").json()
    assert initial["assigned_username"].strip() == "JOHNDOE"

    payload = {
        "user_id": "sarahconnor",
        "remarks": "Reassigned from John Doe to Sarah Connor",
    }
    # Reassign using asset ID
    reassign_res = client.post("/api/assets/1/reassign", json=payload)
    assert reassign_res.status_code == 200, reassign_res.text
    data = reassign_res.json()

    assert data["asset_id"] == 1
    assert data["asset_number"] == "AST-1001"
    assert data["user_id"] == "sarahconnor"
    assert data["user_full_name"] == "Sarah Connor"
    assert data["assigned_username"] == "sarahconnor"
    assert data["assignment_type"] == "MANUAL"
    assert data["remarks"] == "Reassigned from John Doe to Sarah Connor"
    assert data["workday_status"] == "Matched Workday employee"

    # Verify persistence
    persisted = client.get("/api/assets/1").json()
    assert persisted["assigned_username"] == "sarahconnor"
    assert persisted["user_full_name"] == "Sarah Connor"


def test_assign_user_from_ownership_details_payload_with_asset_number(client: TestClient):
    """
    Requirement 2 & 5: Collection endpoint /api/assets/assign accepting asset_number in payload.
    """
    payload = {
        "asset_number": "AST-1003",
        "user_id": "sarahconnor",
        "managed_by": "GROUP",
        "remarks": "Assigned via payload",
    }
    response = client.post("/api/assets/assign", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["asset_number"] == "AST-1003"
    assert data["user_id"] == "sarahconnor"
    assert data["user_full_name"] == "Sarah Connor"
    assert data["managed_by"] == "GROUP"
    assert data["assigned_username"] == "sarahconnor"


def test_assign_user_from_ownership_alias_endpoint(client: TestClient):
    """
    Verifies /api/assets/ownership/{asset_id}/assign and /api/assets/ownership/assign endpoints.
    """
    # 1. Path alias
    res_path = client.post(
        "/api/assets/ownership/3/assign",
        json={"user_id": "sarahconnor", "remarks": "Ownership path alias test"},
    )
    assert res_path.status_code == 200, res_path.text
    assert res_path.json()["asset_number"] == "AST-1003"
    assert res_path.json()["user_id"] == "sarahconnor"
    assert res_path.json()["user_full_name"] == "Sarah Connor"

    # 2. Collection alias
    res_coll = client.post(
        "/api/assets/ownership/assign",
        json={"asset_id": 3, "user_id": "johndoe", "remarks": "Ownership collection alias test"},
    )
    assert res_coll.status_code == 200, res_coll.text
    assert res_coll.json()["user_id"] == "johndoe"
    assert res_coll.json()["user_full_name"] == "John Doe"


def test_assign_user_ownership_validation_errors(client: TestClient):
    """
    Requirement 3 & 7: Proper error validation:
    - 404 for non-existent asset
    - 400 for non-existent Workday employee
    - 400 for inactive/terminated Workday employee
    """
    # 1. Non-existent asset
    res_404 = client.post(
        "/api/assets/NON_EXISTENT_TAG/assign",
        json={"user_id": "sarahconnor"},
    )
    assert res_404.status_code == 404

    # 2. Non-existent employee
    res_emp_not_found = client.post(
        "/api/assets/3/assign",
        json={"user_id": "nonexistent_employee_user_id"},
    )
    assert res_emp_not_found.status_code == 400
    assert "not found" in res_emp_not_found.json()["detail"].lower()

    # 3. Inactive employee (alexturner is Terminated in conftest)
    res_inactive = client.post(
        "/api/assets/3/assign",
        json={"user_id": "alexturner"},
    )
    assert res_inactive.status_code == 400
    assert "cannot be assigned" in res_inactive.json()["detail"].lower()


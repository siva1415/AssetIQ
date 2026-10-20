from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.models.user import User
from tests.conftest import TestingSessionLocal


def _seed_user(username="superadmin01", temp="WorkForceIQ123!", otp=True):
    db = TestingSessionLocal()
    db.query(User).filter(User.username == username).delete()
    db.add(User(
        username=username,
        name="Administrator",
        email=f"{username}@assetiq.internal",
        password_hash=get_password_hash(temp),
        role="super_admin",
        must_change_password=otp,
        is_otp=otp,
    ))
    db.commit()
    db.close()


def test_login_reports_must_change_password(client: TestClient):
    _seed_user()
    res = client.post("/api/auth/login", json={"username": "superadmin01", "password": "WorkForceIQ123!"})
    assert res.status_code == 200
    body = res.json()
    assert body["authenticated"] is True
    assert body["user"]["must_change_password"] is True
    assert body["user"]["is_otp"] is True


def test_login_wrong_password_rejected(client: TestClient):
    _seed_user()
    res = client.post("/api/auth/login", json={"username": "superadmin01", "password": "nope"})
    assert res.status_code == 401


def test_first_login_reset_clears_flags_and_new_password_works(client: TestClient):
    _seed_user()
    res = client.post(
        "/api/auth/first-login-decision",
        json={"username": "superadmin01", "decision": "reset", "newPassword": "MyNewPass1"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    login = client.post("/api/auth/login", json={"username": "superadmin01", "password": "MyNewPass1"})
    assert login.status_code == 200
    assert login.json()["user"]["must_change_password"] is False

    old = client.post("/api/auth/login", json={"username": "superadmin01", "password": "WorkForceIQ123!"})
    assert old.status_code == 401


def test_first_login_reset_rejected_when_not_pending(client: TestClient):
    _seed_user(username="regular", temp="Secret123", otp=False)
    res = client.post(
        "/api/auth/first-login-decision",
        json={"username": "regular", "decision": "reset", "newPassword": "Hijacked1"},
    )
    assert res.status_code == 403


def test_first_login_reset_rejects_short_password(client: TestClient):
    _seed_user()
    res = client.post(
        "/api/auth/first-login-decision",
        json={"username": "superadmin01", "decision": "reset", "newPassword": "abc"},
    )
    assert res.status_code == 400

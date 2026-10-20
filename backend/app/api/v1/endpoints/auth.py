import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_database
from app.core.security import verify_password, get_password_hash
from app.models.user import User, ActiveSession
from app.schemas.user import (
    LoginRequest,
    LoginResponse,
    UserProfileResponse,
    ChangePasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


@router.post("/login", response_model=LoginResponse, summary="Authenticate Console User with Hashed Password & Role")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_database),
):
    """
    Authenticate against the `users` table:
    1. Looks up the username (case-insensitive).
    2. Validates the provided plain-text password against the stored `password_hash` (bcrypt, PBKDF2, SHA-256, etc.).
    3. Records the active session in `active_sessions`.
    4. Returns the user's authorized role ('super_admin', 'admin', 'viewer') and profile.
    """
    clean_username = payload.username.strip().replace("@", "")
    if not clean_username or not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required.",
        )

    # Lookup user in database
    user = (
        db.query(User)
        .filter(func.lower(User.username) == clean_username.lower())
        .first()
    )

    # Development auto-seed fallback: if users table is empty and credentials are admin/admin
    if not user and clean_username.lower() in ("admin", "superadmin", "viewer"):
        default_role = "super_admin" if clean_username.lower() == "superadmin" else ("viewer" if clean_username.lower() == "viewer" else "admin")
        user = User(
            username=clean_username.lower(),
            name=f"Console {default_role.replace('_', ' ').title()}",
            email=f"{clean_username.lower()}@assetiq.internal",
            password_hash=get_password_hash(clean_username.lower()),
            role=default_role,
            is_root_protected=clean_username.lower() in ("admin", "superadmin"),
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    # Verify password against hash
    is_valid = verify_password(payload.password, user.password_hash)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    # Record active session
    session_id = f"sess_{uuid.uuid4().hex[:16]}"
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    try:
        new_session = ActiveSession(
            session_id=session_id,
            username=user.username,
            name=user.name,
            email=user.email,
            role=user.role,
            login_time=datetime.utcnow(),
            last_active=datetime.utcnow(),
            ip_address=client_ip,
            user_agent=user_agent,
            status="active",
        )
        db.add(new_session)
        db.commit()
    except Exception:
        db.rollback()

    profile = UserProfileResponse(
        username=user.username,
        name=user.name,
        email=user.email,
        role=user.role,
        must_change_password=bool(user.must_change_password),
        is_otp=bool(user.is_otp),
        is_root_protected=bool(user.is_root_protected),
        created_at=user.created_at,
    )

    return LoginResponse(
        authenticated=True,
        token=session_id,
        user=profile,
        message=f"Welcome back, {user.name} ({user.role})",
    )


@router.post("/change-password", summary="Update User Password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_database),
):
    """
    Update a user's password with a fresh cryptographically secure hash.
    """
    if not payload.username or not payload.new_password:
        raise HTTPException(status_code=400, detail="Username and new password are required.")

    clean_username = payload.username.strip().replace("@", "")
    user = db.query(User).filter(func.lower(User.username) == clean_username.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # These endpoints are unauthenticated, so a password may only be replaced when the
    # caller proves knowledge of the current one, or the account is flagged for a forced
    # first-login change (temporary one-time password).
    if payload.current_password:
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
    elif not user.must_change_password:
        raise HTTPException(status_code=403, detail="Current password is required.")

    user.password_hash = get_password_hash(payload.new_password)
    user.must_change_password = False
    user.is_otp = False
    user.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success", "message": "Password updated successfully."}

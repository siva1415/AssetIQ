from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database
from app.models.app_user import AppUser
from app.schemas.app_user import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    ROLE_MENU_PERMISSIONS,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate user against PostgreSQL app_users table",
)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_database),
):
    """
    Authenticate dynamic application user:
    - Verifies password hash using bcrypt
    - Rejects invalid credentials with a generic message
    - Rejects users with INACTIVE status
    - Protects against brute-force attempts via rate limiting
    - Returns signed JWT access token, user profile, and must_reset_password flag
    """
    client_ip = request.client.host if request.client else "unknown"
    return AuthService.authenticate_user(db=db, payload=payload, client_ip=client_ip)


@router.post(
    "/change-password",
    response_model=LoginResponse,
    summary="Change user password (mandatory on first login)",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_database),
):
    """
    Change password endpoint accessible during the mandatory first-login reset flow.
    Verifies current password, securely hashes new password with bcrypt, and sets must_reset_password=False.
    """
    return AuthService.change_password(db=db, current_user=current_user, payload=payload)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile and menu permissions",
)
@router.get(
    "/current-user",
    response_model=UserResponse,
    include_in_schema=False,
)
def get_current_user_profile(
    current_user: AppUser = Depends(get_current_user),
):
    """
    Returns the profile and menu permissions for the authenticated caller.
    """
    permissions = ROLE_MENU_PERMISSIONS.get(current_user.role.upper(), [])
    return UserResponse(
        user_id=current_user.user_id,
        id=current_user.user_id,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
        must_reset_password=current_user.must_reset_password,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        permissions=permissions,
    )


@router.get(
    "/last-login",
    summary="Get authenticated portal user's last login timestamp",
)
def get_current_user_last_login(
    current_user: AppUser = Depends(get_current_user),
):
    """
    Returns the authenticated portal user's last login timestamp from app_users.
    """
    return {
        "user_id": current_user.user_id,
        "username": current_user.username,
        "last_login_at": current_user.last_login_at,
    }

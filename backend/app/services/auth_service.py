from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.core.security import (
    create_access_token,
    hash_password,
    is_rate_limited,
    record_failed_login,
    reset_failed_logins,
    verify_password,
)
from app.models.app_user import AppUser
from app.repositories.app_user_repository import AppUserRepository
from app.schemas.app_user import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    ROLE_MENU_PERMISSIONS,
    UserResponse,
)


class AuthService:
    """
    Business logic for dynamic authentication against the PostgreSQL app_users table,
    token generation, first-login password reset, and brute-force attempt protection.
    """

    @classmethod
    def authenticate_user(
        cls,
        db: Session,
        payload: LoginRequest,
        client_ip: Optional[str] = None,
    ) -> LoginResponse:
        """
        Authenticate user credentials against app_users table with bcrypt verification.
        Enforces status active check and rate limiting.
        """
        raw_username = payload.username.strip()
        throttle_key = raw_username.lower()

        # 1. Check rate limit
        if is_rate_limited(throttle_key):
            logger.warning(f"Rate limited login attempt for username '{raw_username}'")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please wait a few minutes before trying again.",
            )

        # 2. Lookup user in app_users
        user = AppUserRepository.get_by_username(db, raw_username)
        if not user:
            record_failed_login(throttle_key)
            logger.info(f"Failed login attempt: username '{raw_username}' not found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 3. Check status is ACTIVE
        user_status = user.status.strip().upper() if user.status else ""
        if user_status != "ACTIVE":
            record_failed_login(throttle_key)
            logger.info(f"Login rejected: user '{user.username}' has status '{user.status}'")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive. Please contact an administrator.",
            )

        # 4. Verify password with bcrypt
        if not verify_password(payload.password, user.password_hash):
            record_failed_login(throttle_key)
            logger.info(f"Failed login attempt: incorrect password for user '{user.username}'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 5. Clear failed attempts on success
        reset_failed_logins(throttle_key)

        # 6. Update last_login_at and updated_at
        now = datetime.now(timezone.utc)
        user.last_login_at = now
        user.updated_at = now
        db.commit()
        db.refresh(user)

        # 7. Generate cryptographically signed JWT token
        token_payload = {
            "sub": str(user.user_id),
            "user_id": user.user_id,
            "username": user.username,
            "role": user.role,
            "must_reset_password": user.must_reset_password,
        }
        access_token = create_access_token(token_payload)

        permissions = ROLE_MENU_PERMISSIONS.get(user.role.upper(), [])

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user.user_id,
            id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            status=user.status,
            must_reset_password=user.must_reset_password,
            last_login_at=user.last_login_at,
            permissions=permissions,
        )

    @classmethod
    def change_password(
        cls,
        db: Session,
        current_user: AppUser,
        payload: ChangePasswordRequest,
    ) -> LoginResponse:
        """
        Verify current password and update to new password.
        Sets must_reset_password to False upon successful update.
        """
        # Always fetch fresh state from DB
        user = AppUserRepository.get_by_id(db, current_user.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User account not found",
            )

        # Verify current password
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password verification failed",
            )

        clean_new = payload.new_password.strip()
        if len(clean_new) < 8:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="New password must be at least 8 characters in length",
            )

        if payload.current_password == clean_new:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from your current password",
            )

        # Hash new password with bcrypt
        old_must_reset = user.must_reset_password
        user.password_hash = hash_password(clean_new)
        user.must_reset_password = False
        user.updated_at = datetime.now(timezone.utc)

        from app.services.audit_service import AuditService
        AuditService.record_audit(
            db=db,
            actor=user,
            category="USER MANAGEMENT",
            action="CHANGE PASSWORD",
            entity_type="PORTAL USER",
            entity_id=str(user.user_id),
            entity_name=user.username,
            audit_finding=f"User '{user.username}' changed their account password.",
            old_values={"must_reset_password": old_must_reset},
            new_values={"must_reset_password": False},
            status="SUCCESS",
            commit=False,
        )

        db.commit()
        db.refresh(user)

        # Issue fresh token with must_reset_password = False
        token_payload = {
            "sub": str(user.user_id),
            "user_id": user.user_id,
            "username": user.username,
            "role": user.role,
            "must_reset_password": False,
        }
        access_token = create_access_token(token_payload)
        permissions = ROLE_MENU_PERMISSIONS.get(user.role.upper(), [])

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user.user_id,
            id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            status=user.status,
            must_reset_password=False,
            last_login_at=user.last_login_at,
            permissions=permissions,
        )

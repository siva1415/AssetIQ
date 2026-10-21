from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.core.security import hash_password
from app.models.app_user import AppUser
from app.repositories.app_user_repository import AppUserRepository
from app.schemas.app_user import (
    ResetPasswordResponse,
    ROLE_MENU_PERMISSIONS,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)


class AppUserService:
    """
    Business logic and RBAC enforcement for user management:
    - User creation with temporary password test@123
    - Superadmin protection rules (admins cannot touch superadmins)
    - Prevention of deactivating the last active superadmin
    - Safe retrieval and update operations
    """

    @classmethod
    def list_users(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Tuple[List[UserResponse], int]:
        skip = (page - 1) * page_size
        users, total = AppUserRepository.list_users(
            db=db,
            skip=skip,
            limit=page_size,
            search=search,
            role=role,
            status=status,
        )

        response_items = []
        for u in users:
            permissions = ROLE_MENU_PERMISSIONS.get(u.role.upper(), [])
            item = UserResponse(
                user_id=u.user_id,
                id=u.user_id,
                username=u.username,
                full_name=u.full_name,
                email=u.email,
                role=u.role,
                status=u.status,
                must_reset_password=u.must_reset_password,
                last_login_at=u.last_login_at,
                created_at=u.created_at,
                updated_at=u.updated_at,
                permissions=permissions,
            )
            response_items.append(item)

        return response_items, total

    @classmethod
    def get_user_by_id(cls, db: Session, user_id: int) -> UserResponse:
        user = AppUserRepository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found",
            )
        permissions = ROLE_MENU_PERMISSIONS.get(user.role.upper(), [])
        return UserResponse(
            user_id=user.user_id,
            id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            status=user.status,
            must_reset_password=user.must_reset_password,
            last_login_at=user.last_login_at,
            created_at=user.created_at,
            updated_at=user.updated_at,
            permissions=permissions,
        )

    @classmethod
    def create_user(
        cls,
        db: Session,
        caller: AppUser,
        payload: UserCreateRequest,
    ) -> UserResponse:
        """
        Create a new user:
        - Must have unique username and email
        - Initial temporary password test@123
        - status='ACTIVE', must_reset_password=True
        - Only SUPERADMIN can assign the SUPERADMIN role
        """
        target_role = payload.role.strip().upper()
        caller_role = caller.role.strip().upper()

        if target_role == "SUPERADMIN" and caller_role != "SUPERADMIN":
            logger.warning(
                f"Unauthorized role elevation attempt: user '{caller.username}' ({caller.role}) "
                f"attempted to create SUPERADMIN user '{payload.username}'"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only SUPERADMIN accounts can create or assign the SUPERADMIN role.",
            )

        # Check unique username
        existing_username = AppUserRepository.get_by_username(db, payload.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{payload.username}' is already taken",
            )

        # Check unique email
        existing_email = AppUserRepository.get_by_email(db, payload.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email address '{payload.email}' is already registered",
            )

        # Hash default temporary password test@123
        temp_password = settings.DEFAULT_TEMPORARY_PASSWORD
        hashed = hash_password(temp_password)

        now = datetime.now(timezone.utc)
        new_user = AppUser(
            username=payload.username.strip(),
            password_hash=hashed,
            full_name=payload.full_name.strip(),
            email=payload.email.strip().lower(),
            role=target_role,
            status="ACTIVE",
            must_reset_password=True,
            created_at=now,
            updated_at=now,
        )

        created = AppUserRepository.create(db, new_user)
        logger.info(
            f"User '{created.username}' (ID={created.user_id}, role={created.role}) "
            f"successfully created by '{caller.username}'"
        )

        from app.services.audit_service import AuditService
        AuditService.record_audit(
            db=db,
            actor=caller,
            category="USER MANAGEMENT",
            action="ADD PORTAL USER",
            entity_type="PORTAL USER",
            entity_id=str(created.user_id),
            entity_name=created.username,
            audit_finding=f"Created portal user '{created.username}' with role '{created.role}'.",
            new_values={
                "username": created.username,
                "full_name": created.full_name,
                "email": created.email,
                "role": created.role,
                "status": created.status,
            },
            status="SUCCESS",
            commit=True,
        )

        permissions = ROLE_MENU_PERMISSIONS.get(created.role.upper(), [])
        return UserResponse(
            user_id=created.user_id,
            id=created.user_id,
            username=created.username,
            full_name=created.full_name,
            email=created.email,
            role=created.role,
            status=created.status,
            must_reset_password=created.must_reset_password,
            last_login_at=created.last_login_at,
            created_at=created.created_at,
            updated_at=created.updated_at,
            permissions=permissions,
        )

    @classmethod
    def update_user(
        cls,
        db: Session,
        user_id: int,
        caller: AppUser,
        payload: UserUpdateRequest,
    ) -> UserResponse:
        """
        Update user details and role subject to RBAC rules:
        - ADMIN cannot modify a SUPERADMIN account
        - ADMIN cannot promote any user to SUPERADMIN
        - Cannot deactivate the last active SUPERADMIN
        """
        target = AppUserRepository.get_by_id(db, user_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found",
            )

        caller_role = caller.role.strip().upper()
        target_role = target.role.strip().upper()

        # Rule: ADMIN cannot modify a SUPERADMIN account
        if target_role == "SUPERADMIN" and caller_role != "SUPERADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative users cannot modify a SUPERADMIN account.",
            )

        old_full_name = target.full_name
        old_email = target.email
        old_role = target.role
        old_status = target.status

        # Rule: Only SUPERADMIN can assign/promote to SUPERADMIN
        if payload.role is not None:
            new_role = payload.role.strip().upper()
            if new_role == "SUPERADMIN" and caller_role != "SUPERADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only SUPERADMIN accounts can assign the SUPERADMIN role.",
                )
            target.role = new_role

        # Rule: Check status change
        if payload.status is not None:
            new_status = payload.status.strip().upper()
            if new_status == "INACTIVE" and target_role == "SUPERADMIN":
                if caller_role != "SUPERADMIN":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Administrative users cannot deactivate a SUPERADMIN account.",
                    )
                active_superadmins = AppUserRepository.count_active_superadmins(db)
                if active_superadmins <= 1 and target.status == "ACTIVE":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot deactivate the last active SUPERADMIN account.",
                    )
            target.status = new_status

        if payload.full_name is not None and payload.full_name.strip():
            target.full_name = payload.full_name.strip()

        if payload.email is not None and payload.email.strip():
            clean_email = payload.email.strip().lower()
            if clean_email != target.email.lower():
                existing_email = AppUserRepository.get_by_email(db, clean_email)
                if existing_email and existing_email.user_id != target.user_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Email address '{clean_email}' is already registered to another user",
                    )
                target.email = clean_email

        target.updated_at = datetime.now(timezone.utc)

        from app.services.audit_service import AuditService
        AuditService.record_audit(
            db=db,
            actor=caller,
            category="USER MANAGEMENT",
            action="EDIT PORTAL USER",
            entity_type="PORTAL USER",
            entity_id=str(target.user_id),
            entity_name=target.username,
            audit_finding=f"Updated portal user '{target.username}' details.",
            old_values={
                "full_name": old_full_name,
                "email": old_email,
                "role": old_role,
                "status": old_status,
            },
            new_values={
                "full_name": target.full_name,
                "email": target.email,
                "role": target.role,
                "status": target.status,
            },
            status="SUCCESS",
            commit=False,
        )

        db.commit()
        db.refresh(target)

        permissions = ROLE_MENU_PERMISSIONS.get(target.role.upper(), [])
        return UserResponse(
            user_id=target.user_id,
            id=target.user_id,
            username=target.username,
            full_name=target.full_name,
            email=target.email,
            role=target.role,
            status=target.status,
            must_reset_password=target.must_reset_password,
            last_login_at=target.last_login_at,
            created_at=target.created_at,
            updated_at=target.updated_at,
            permissions=permissions,
        )

    @classmethod
    def update_user_status(
        cls,
        db: Session,
        user_id: int,
        caller: AppUser,
        new_status: str,
    ) -> UserResponse:
        """
        Activate or deactivate a user with superadmin safeguards.
        """
        target = AppUserRepository.get_by_id(db, user_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found",
            )

        caller_role = caller.role.strip().upper()
        target_role = target.role.strip().upper()
        clean_status = new_status.strip().upper()

        if target_role == "SUPERADMIN" and caller_role != "SUPERADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative users cannot deactivate or modify a SUPERADMIN account.",
            )

        if clean_status == "INACTIVE" and target_role == "SUPERADMIN":
            active_superadmins = AppUserRepository.count_active_superadmins(db)
            if active_superadmins <= 1 and target.status == "ACTIVE":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the last active SUPERADMIN account.",
                )

        old_status = target.status
        target.status = clean_status
        target.updated_at = datetime.now(timezone.utc)

        action = "DEACTIVATE USER" if clean_status == "INACTIVE" else "ACTIVATE USER"
        finding = (
            f"Deactivated portal user account '{target.username}'."
            if clean_status == "INACTIVE"
            else f"Activated portal user account '{target.username}'."
        )

        from app.services.audit_service import AuditService
        AuditService.record_audit(
            db=db,
            actor=caller,
            category="USER MANAGEMENT",
            action=action,
            entity_type="PORTAL USER",
            entity_id=str(target.user_id),
            entity_name=target.username,
            audit_finding=finding,
            old_values={"status": old_status},
            new_values={"status": clean_status},
            status="SUCCESS",
            commit=False,
        )

        db.commit()
        db.refresh(target)

        permissions = ROLE_MENU_PERMISSIONS.get(target.role.upper(), [])
        return UserResponse(
            user_id=target.user_id,
            id=target.user_id,
            username=target.username,
            full_name=target.full_name,
            email=target.email,
            role=target.role,
            status=target.status,
            must_reset_password=target.must_reset_password,
            last_login_at=target.last_login_at,
            created_at=target.created_at,
            updated_at=target.updated_at,
            permissions=permissions,
        )

    @classmethod
    def reset_user_password(
        cls,
        db: Session,
        user_id: int,
        caller: AppUser,
    ) -> ResetPasswordResponse:
        """
        Reset a user's password to the default temporary password and set must_reset_password=True.
        ADMIN cannot reset password for SUPERADMIN.
        """
        target = AppUserRepository.get_by_id(db, user_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found",
            )

        caller_role = caller.role.strip().upper()
        target_role = target.role.strip().upper()

        if target_role == "SUPERADMIN" and caller_role != "SUPERADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative users cannot reset password for a SUPERADMIN account.",
            )

        old_reset_flag = target.must_reset_password
        temp_password = settings.DEFAULT_TEMPORARY_PASSWORD
        target.password_hash = hash_password(temp_password)
        target.must_reset_password = True
        target.updated_at = datetime.now(timezone.utc)

        from app.services.audit_service import AuditService
        AuditService.record_audit(
            db=db,
            actor=caller,
            category="USER MANAGEMENT",
            action="RESET PASSWORD",
            entity_type="PORTAL USER",
            entity_id=str(target.user_id),
            entity_name=target.username,
            audit_finding=f"Reset temporary password for portal user '{target.username}'.",
            old_values={"must_reset_password": old_reset_flag},
            new_values={"must_reset_password": True},
            status="SUCCESS",
            commit=False,
        )

        db.commit()
        db.refresh(target)

        logger.info(f"Password reset for user '{target.username}' by '{caller.username}'")
        return ResetPasswordResponse(
            message=f"Password for user '{target.username}' has been reset to temporary password.",
            user_id=target.user_id,
            username=target.username,
            must_reset_password=True,
        )

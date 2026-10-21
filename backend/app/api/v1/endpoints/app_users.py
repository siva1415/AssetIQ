import math
from typing import Optional, Union
from fastapi import APIRouter, Body, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_database, require_admin
from app.models.app_user import AppUser
from app.schemas.app_user import (
    ResetPasswordResponse,
    UserCreateRequest,
    UserResponse,
    UserStatusUpdateRequest,
    UserUpdateRequest,
)
from app.schemas.common import PaginatedResponse
from app.services.app_user_service import AppUserService

router = APIRouter(prefix="/app-users", tags=["User Management"])


@router.get(
    "",
    response_model=PaginatedResponse[UserResponse],
    summary="List application users with search, pagination, and filters",
)
def list_app_users(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    pageSize: Optional[int] = Query(None, include_in_schema=False),
    limit: Optional[int] = Query(None, include_in_schema=False),
    offset: Optional[int] = Query(None, include_in_schema=False),
    search: Optional[str] = Query(None, description="Search by username, full name, or email"),
    q: Optional[str] = Query(None, include_in_schema=False),
    role: Optional[str] = Query(None, description="Filter by role (SUPERADMIN, ADMIN, VIEWER)"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, INACTIVE)"),
    caller: AppUser = Depends(require_admin),
    db: Session = Depends(get_database),
):
    """
    List portal users with pagination, text search, and role/status filtering.
    Restricted to SUPERADMIN and ADMIN callers.
    """
    eff_size = pageSize or limit or page_size
    eff_search = search or q
    eff_page = page
    if offset is not None and page == 1:
        eff_page = (offset // eff_size) + 1 if eff_size > 0 else 1

    items, total = AppUserService.list_users(
        db=db,
        page=eff_page,
        page_size=eff_size,
        search=eff_search,
        role=role,
        status=status,
    )
    total_pages = math.ceil(total / eff_size) if eff_size > 0 else 0

    return PaginatedResponse[UserResponse](
        items=items,
        data=items,
        total=total,
        total_items=total,
        page=eff_page,
        page_size=eff_size,
        total_pages=total_pages,
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new application user",
)
def create_app_user(
    payload: UserCreateRequest,
    caller: AppUser = Depends(require_admin),
    db: Session = Depends(get_database),
):
    """
    Create a new application user:
    - Default initial temporary password test@123 (hashed with bcrypt)
    - must_reset_password set to TRUE
    - Only SUPERADMIN accounts can assign the SUPERADMIN role
    - Returns safe profile fields, never the password or hash
    """
    return AppUserService.create_user(db=db, caller=caller, payload=payload)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Retrieve application user details by user ID",
)
def get_app_user(
    user_id: int = Path(..., description="Application user ID"),
    caller: AppUser = Depends(require_admin),
    db: Session = Depends(get_database),
):
    """
    Retrieve user details by ID. Excludes password hash.
    """
    return AppUserService.get_user_by_id(db=db, user_id=user_id)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update application user details and role",
)
def update_app_user(
    user_id: int = Path(..., description="Application user ID"),
    payload: UserUpdateRequest = Body(...),
    caller: AppUser = Depends(require_admin),
    db: Session = Depends(get_database),
):
    """
    Update user profile and role subject to RBAC rules:
    - ADMIN cannot modify or deactivate a SUPERADMIN
    - Only SUPERADMIN can assign the SUPERADMIN role
    - Cannot deactivate the last active SUPERADMIN
    """
    return AppUserService.update_user(
        db=db,
        user_id=user_id,
        caller=caller,
        payload=payload,
    )


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    summary="Activate or deactivate application user",
)
def update_app_user_status(
    user_id: int = Path(..., description="Application user ID"),
    payload: Optional[UserStatusUpdateRequest] = None,
    status_query: Optional[str] = Query(None, alias="status", include_in_schema=False),
    caller: AppUser = Depends(require_admin),
    db: Session = Depends(get_database),
):
    """
    Activate or deactivate a user account:
    - ADMIN cannot deactivate a SUPERADMIN
    - Cannot deactivate the last active SUPERADMIN
    """
    eff_status = None
    if payload and payload.status:
        eff_status = payload.status
    elif status_query:
        eff_status = status_query

    if not eff_status:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Status field is required ('ACTIVE' or 'INACTIVE')",
        )

    return AppUserService.update_user_status(
        db=db,
        user_id=user_id,
        caller=caller,
        new_status=eff_status,
    )


@router.post(
    "/{user_id}/reset-password",
    response_model=ResetPasswordResponse,
    summary="Reset user password to temporary password",
)
def reset_app_user_password(
    user_id: int = Path(..., description="Application user ID"),
    caller: AppUser = Depends(require_admin),
    db: Session = Depends(get_database),
):
    """
    Reset user's password to configured temporary password (test@123) and set must_reset_password=True.
    ADMIN accounts cannot reset password for SUPERADMIN accounts.
    """
    return AppUserService.reset_user_password(
        db=db,
        user_id=user_id,
        caller=caller,
    )

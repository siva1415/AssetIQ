from typing import List, Optional, Union
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import PaginationParams, get_database
from app.schemas.admin_user import (
    AdminUserResponse,
    AdminUserCreateRequest,
    AdminUserCreateItem,
    AdminUserBulkResponse,
    AvailableAdminUserItem,
)
from app.schemas.common import PaginatedResponse
from app.services.admin_user_service import AdminUserService

router = APIRouter(prefix="/admin-users", tags=["Admin Users"])


@router.get(
    "/available-users",
    response_model=PaginatedResponse[AvailableAdminUserItem],
    summary="List Workday HCM Employees Available for Admin Authorization",
)
def get_available_users(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None, description="Search by user ID, full name, or work email"),
    q: Optional[str] = Query(None, include_in_schema=False),
    query: Optional[str] = Query(None, include_in_schema=False),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    userId: Optional[str] = Query(None, include_in_schema=False),
    full_name: Optional[str] = Query(None, description="Filter by full name"),
    fullName: Optional[str] = Query(None, include_in_schema=False),
    name: Optional[str] = Query(None, include_in_schema=False),
    email: Optional[str] = Query(None, description="Filter by work email"),
    email_work: Optional[str] = Query(None, include_in_schema=False),
    emailWork: Optional[str] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Retrieve employees from workday_employees who are not currently registered as admins.
    Supports searching by user ID, full name, work email, and pagination.
    """
    eff_search = search or q or query
    eff_user_id = user_id or userId
    eff_name = full_name or fullName or name
    eff_email = email or email_work or emailWork

    return AdminUserService.get_available_users(
        db=db,
        page=pagination.page,
        page_size=pagination.page_size,
        search=eff_search,
        user_id=eff_user_id,
        full_name=eff_name,
        email=eff_email,
    )


@router.post(
    "/available-users",
    response_model=AdminUserBulkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Authorize Admin Users (Alias for available-users path)",
    include_in_schema=False,
)
def add_admin_users_via_available_users_alias(
    payload: Union[AdminUserCreateRequest, List[Union[str, AdminUserCreateItem]]],
    db: Session = Depends(get_database),
):
    """
    Alias route ensuring POST requests sent to /available-users do not encounter HTTP 405 Method Not Allowed.
    """
    return add_admin_users(payload=payload, db=db)


@router.get(
    "",
    response_model=List[AdminUserResponse],
    summary="List Admin Users Joined to Workday Employee Profiles",
)
def list_admin_users(db: Session = Depends(get_database)):
    """
    Retrieve all authorized admin users correlated with their Workday HCM profile.
    """
    return AdminUserService.list_admin_users(db)


@router.post(
    "",
    response_model=AdminUserBulkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Bulk Authorize One or More Admin Users",
)
def add_admin_users(
    payload: Union[AdminUserCreateRequest, List[Union[str, AdminUserCreateItem]]],
    db: Session = Depends(get_database),
):
    """
    Bulk authorize admin users.
    Accepts:
    - `{"user_ids": ["EMP001", "EMP002"]}`
    - `{"admin_user_ids": [...]}`
    - `["EMP001", "EMP002"]`
    - Single ID: `{"user_id": "EMP001"}` or `{"admin_user_id": "EMP001"}`

    Verifies existence in Workday HCM, prevents duplicate entries, inserts transactionally,
    and returns a summary of inserted, skipped, and invalid user IDs.
    """
    if isinstance(payload, list):
        req = AdminUserCreateRequest(users=payload)
    else:
        req = payload

    return AdminUserService.add_admin_users(db, req)


@router.delete(
    "/{admin_user_id}",
    summary="Remove Authorized Admin User",
)
def remove_admin_user(
    admin_user_id: str,
    db: Session = Depends(get_database),
):
    """
    Revoke administrative access for a user ID.
    """
    return AdminUserService.delete_admin_user(db, admin_user_id)


from typing import List, Union
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_database
from app.schemas.admin_user import (
    AdminUserResponse,
    AdminUserCreateRequest,
    AdminUserCreateItem,
)
from app.services.admin_user_service import AdminUserService

router = APIRouter(prefix="/admin-users", tags=["Admin Users"])


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
    response_model=List[AdminUserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Authorize One or More Admin Users",
)
def add_admin_users(
    payload: Union[AdminUserCreateRequest, List[Union[str, AdminUserCreateItem]]],
    db: Session = Depends(get_database),
):
    """
    Add authorized admin user(s). Handles single IDs, ID lists, or nested payload objects safely.
    """
    if isinstance(payload, list):
        req = AdminUserCreateRequest(
            admin_user_ids=[
                item if isinstance(item, str) else item.admin_user_id for item in payload
            ]
        )
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

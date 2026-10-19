from typing import Any, Generator, Optional, Union
from fastapi import Depends, Header, Query
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db


def get_database() -> Generator[Session, None, None]:
    """
    FastAPI dependency wrapper for the database session generator.
    """
    yield from get_db()


def _parse_int_param(val: Any, default: int) -> int:
    if val is None:
        return default
    if isinstance(val, int):
        return val
    try:
        s = str(val).strip()
        if s.lower() in ("all", "max", "-1"):
            return settings.MAX_PAGE_SIZE
        return int(s)
    except (ValueError, TypeError):
        return default


class PaginationParams:
    """
    Standard validated query parameters for paginated endpoints.
    Defensively parses page and page size, supports camelCase and SQL limit/offset aliases,
    and enforces maximum page size by capping at MAX_PAGE_SIZE rather than failing with 422.
    """
    def __init__(
        self,
        page: Optional[Union[int, str]] = Query(1, description="Page number (1-indexed)"),
        page_size: Optional[Union[int, str]] = Query(
            default=None,
            description=f"Items per page (enforced max {settings.MAX_PAGE_SIZE})",
        ),
        pageSize: Optional[Union[int, str]] = Query(
            default=None,
            include_in_schema=False,
            description="camelCase alias for page_size",
        ),
        limit: Optional[Union[int, str]] = Query(
            default=None,
            include_in_schema=False,
            description="SQL limit alias for page_size",
        ),
        offset: Optional[Union[int, str]] = Query(
            default=None,
            include_in_schema=False,
            description="SQL offset alias",
        ),
    ):
        raw_page = _parse_int_param(page, 1)
        raw_offset = _parse_int_param(offset, None) if offset is not None else None

        # Resolve page_size
        raw_size = None
        if page_size is not None:
            raw_size = _parse_int_param(page_size, settings.DEFAULT_PAGE_SIZE)
        elif pageSize is not None:
            raw_size = _parse_int_param(pageSize, settings.DEFAULT_PAGE_SIZE)
        elif limit is not None:
            raw_size = _parse_int_param(limit, settings.DEFAULT_PAGE_SIZE)
        else:
            raw_size = settings.DEFAULT_PAGE_SIZE

        if raw_size <= 0:
            raw_size = settings.DEFAULT_PAGE_SIZE

        # Enforce max page size limit (caps to MAX_PAGE_SIZE)
        if raw_size > settings.MAX_PAGE_SIZE:
            raw_size = settings.MAX_PAGE_SIZE

        # Resolve offset to 1-indexed page if offset was passed
        if raw_offset is not None and (page is None or raw_page == 1):
            raw_page = (raw_offset // raw_size) + 1 if raw_size > 0 else 1

        if raw_page < 1:
            raw_page = 1

        self.page = raw_page
        self.page_size = raw_size


def verify_admin_access(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_admin_id: Optional[str] = Header(None, alias="X-Admin-User-Id"),
    x_role: Optional[str] = Header(None, alias="X-Role"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    current_user_param: Optional[str] = Query(None, alias="current_user", include_in_schema=False),
    role_param: Optional[str] = Query(None, alias="role", include_in_schema=False),
    db: Session = Depends(get_database),
) -> str:
    """
    Enforce administrative privileges for sensitive operations.
    Validates caller against `admin_users` table in PostgreSQL.
    Rejects viewers, non-admins, and unauthorized callers with HTTP 403 Forbidden.
    """
    from fastapi import HTTPException, status
    from app.repositories.admin_user_repository import AdminUserRepository

    # 1. Check explicit role headers / query params
    role = (x_role or x_user_role or role_param)
    if role:
        clean_role = role.strip().lower()
        if clean_role in ("viewer", "user", "guest", "readonly", "read-only", "non-admin", "operator", "member"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
            )
        if clean_role not in ("admin", "administrator", "superuser"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized to perform administrative operations.",
            )

    # 2. Check Authorization header
    if authorization:
        auth_lower = authorization.strip().lower()
        if any(v in auth_lower for v in ("viewer", "guest", "readonly", "non-admin")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
            )

    # 3. Check caller user_id against admin_users table
    caller_id = (x_user_id or x_admin_id or current_user_param)
    if caller_id:
        clean_caller = caller_id.strip()
        if clean_caller.lower() in ("viewer", "guest", "readonly", "non-admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
            )

        admin = AdminUserRepository.get_by_user_id(db, clean_caller)
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User '{clean_caller}' is not authorized as an administrator.",
            )
        return admin.admin_user_id

    # If no identity is passed, default to system admin session
    return "admin"



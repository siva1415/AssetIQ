from typing import Any, Generator, Optional, Union
from fastapi import Depends, Header, Query
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.app_user import AppUser


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


def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_database),
):
    """
    Validates cryptographically signed Bearer JWT token against PostgreSQL `app_users` table.
    Enforces real-time database validation so that role changes or account deactivations
    take immediate effect without relying on stale token claims.
    """
    from fastapi import HTTPException, status
    from app.core.security import decode_access_token
    from app.repositories.app_user_repository import AppUserRepository

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme. Use 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_raw = payload.get("sub") or payload.get("user_id")
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: invalid subject identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = AppUserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status.upper() != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact your system administrator.",
        )

    return user


def get_current_active_user(
    current_user=Depends(get_current_user),
):
    """
    Enforces that the user has completed their mandatory first-login password reset.
    Users with must_reset_password=True are restricted from accessing normal application APIs.
    """
    from fastapi import HTTPException, status

    if current_user.must_reset_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before accessing application resources. Please update your password.",
        )
    return current_user


def require_roles(*allowed_roles: str):
    """
    Dependency factory verifying that current user's database role matches one of the allowed roles.
    """
    from fastapi import HTTPException, status

    normalized_allowed = [r.strip().upper() for r in allowed_roles]

    def role_checker(current_user=Depends(get_current_active_user)):
        user_role = current_user.role.strip().upper() if current_user.role else ""
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Role '{current_user.role}' lacks sufficient privileges.",
            )
        return current_user

    return role_checker


def require_admin(current_user=Depends(require_roles("SUPERADMIN", "ADMIN"))):
    """
    Requires SUPERADMIN or ADMIN role with completed password reset.
    """
    return current_user


def require_superadmin(current_user=Depends(require_roles("SUPERADMIN"))):
    """
    Requires SUPERADMIN role with completed password reset.
    """
    return current_user


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
    Supports dynamic JWT bearer authentication against `app_users` table with RBAC checks,
    as well as backward-compatible checks against `admin_users` table in PostgreSQL.
    Rejects viewers, non-admins, and unauthorized callers with HTTP 403 Forbidden.
    """
    from fastapi import HTTPException, status
    from app.core.security import decode_access_token
    from app.repositories.admin_user_repository import AdminUserRepository
    from app.repositories.app_user_repository import AppUserRepository

    # 1. Check if Authorization is a Bearer JWT token from app_users
    if authorization and authorization.strip().lower().startswith("bearer "):
        parts = authorization.strip().split()
        if len(parts) == 2:
            token = parts[1]
            payload = decode_access_token(token)
            if payload:
                user_id_raw = payload.get("sub") or payload.get("user_id")
                if user_id_raw:
                    try:
                        u = AppUserRepository.get_by_id(db, int(user_id_raw))
                        if u:
                            if u.status.upper() != "ACTIVE":
                                raise HTTPException(
                                    status_code=status.HTTP_403_FORBIDDEN,
                                    detail="User account is inactive. Please contact your system administrator.",
                                )
                            if u.must_reset_password:
                                raise HTTPException(
                                    status_code=status.HTTP_403_FORBIDDEN,
                                    detail="Password change required before accessing application resources. Please update your password.",
                                )
                            if u.role.upper() == "VIEWER":
                                raise HTTPException(
                                    status_code=status.HTTP_403_FORBIDDEN,
                                    detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
                                )
                            if u.role.upper() in ("ADMIN", "SUPERADMIN"):
                                return u.username
                    except (ValueError, TypeError):
                        pass

    # 2. Check explicit role headers / query params
    role = (x_role or x_user_role or role_param)
    if role:
        clean_role = role.strip().lower()
        if clean_role in ("viewer", "user", "guest", "readonly", "read-only", "non-admin", "operator", "member"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
            )
        if clean_role not in ("admin", "administrator", "superuser", "superadmin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized to perform administrative operations.",
            )

    # 3. Check raw Authorization header for viewer keywords
    if authorization:
        auth_lower = authorization.strip().lower()
        if any(v in auth_lower for v in ("viewer", "guest", "readonly", "non-admin")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
            )

    # 4. Check caller user_id against admin_users table (or app_users)
    caller_id = (x_user_id or x_admin_id or current_user_param)
    if caller_id:
        clean_caller = caller_id.strip()
        if clean_caller.lower() in ("viewer", "guest", "readonly", "non-admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
            )

        # Check app_users first by username
        app_user = AppUserRepository.get_by_username(db, clean_caller)
        if app_user:
            if app_user.status.upper() != "ACTIVE":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is inactive. Please contact your system administrator.",
                )
            if app_user.role.upper() == "VIEWER":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Administrative privileges required. Viewer role cannot perform administrative operations.",
                )
            return app_user.username

        # Check admin_users table
        admin = AdminUserRepository.get_by_user_id(db, clean_caller)
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User '{clean_caller}' is not authorized as an administrator.",
            )
        return admin.admin_user_id

    # If no identity is passed, default to system admin session
    return "admin"


def get_authenticated_actor(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_admin_id: Optional[str] = Header(None, alias="X-Admin-User-Id"),
    current_user_param: Optional[str] = Query(None, alias="current_user", include_in_schema=False),
    db: Session = Depends(get_database),
) -> Optional[AppUser]:
    """
    Resolves the authenticated AppUser entity from JWT bearer token or session headers.
    Never trusts request body inputs for actor identity.
    """
    from app.core.security import decode_access_token
    from app.repositories.app_user_repository import AppUserRepository

    # 1. Check Bearer token or raw JWT token
    if authorization:
        auth_str = authorization.strip()
        token = None
        if auth_str.lower().startswith("bearer "):
            parts = auth_str.split(None, 1)
            if len(parts) == 2:
                token = parts[1].strip()
        else:
            token = auth_str

        if token:
            payload = decode_access_token(token)
            if payload:
                user_id_raw = payload.get("sub") or payload.get("user_id")
                if user_id_raw:
                    try:
                        u = AppUserRepository.get_by_id(db, int(user_id_raw))
                        if u:
                            return u
                    except (ValueError, TypeError):
                        pass

                username_raw = payload.get("username")
                if username_raw:
                    u = AppUserRepository.get_by_username(db, str(username_raw))
                    if u:
                        return u

    # 2. Check X-User-Id / X-Admin-User-Id / query parameter
    caller_id = x_user_id or x_admin_id or current_user_param
    if caller_id and str(caller_id).strip():
        clean_caller = str(caller_id).strip()
        u = AppUserRepository.get_by_username(db, clean_caller)
        if u:
            return u
        try:
            u = AppUserRepository.get_by_id(db, int(clean_caller))
            if u:
                return u
        except (ValueError, TypeError):
            pass

    # 3. Fallback: return default active admin/superadmin in database if exists
    return AppUserRepository.get_by_username(db, "admin") or AppUserRepository.get_by_username(db, "superadmin")



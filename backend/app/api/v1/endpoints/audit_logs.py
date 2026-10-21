from datetime import datetime
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_database, require_superadmin
from app.models.app_user import AppUser
from app.schemas.audit_log import AuditLogResponse
from app.schemas.common import PaginatedResponse
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get(
    "",
    response_model=PaginatedResponse[AuditLogResponse],
    summary="Retrieve paginated audit logs with dynamic filtering",
)
def get_audit_logs(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    pageSize: Optional[int] = Query(None, include_in_schema=False),
    limit: Optional[int] = Query(None, include_in_schema=False),
    offset: Optional[int] = Query(None, include_in_schema=False),
    search: Optional[str] = Query(None, description="Search asset tag, portal username, entity name, finding"),
    q: Optional[str] = Query(None, include_in_schema=False),
    category: Optional[str] = Query(None, description="Filter by audit category (e.g. ASSET OWNERSHIP, EOL MANAGEMENT)"),
    action: Optional[str] = Query(None, description="Filter by action (e.g. ASSIGN USER, BULK ASSIGN, CREATE MODEL)"),
    portal_username: Optional[str] = Query(None, description="Filter by portal actor username"),
    portalUsername: Optional[str] = Query(None, include_in_schema=False),
    status: Optional[str] = Query(None, description="Filter by outcome status (SUCCESS / FAILURE)"),
    start_date: Optional[datetime] = Query(None, description="Filter events on or after this timestamp"),
    startDate: Optional[datetime] = Query(None, include_in_schema=False),
    end_date: Optional[datetime] = Query(None, description="Filter events on or before this timestamp"),
    endDate: Optional[datetime] = Query(None, include_in_schema=False),
    caller: AppUser = Depends(require_superadmin),
    db: Session = Depends(get_database),
):
    """
    Retrieve server-side filtered, paginated audit logs sorted newest first.
    Strictly restricted to SUPERADMIN callers in accordance with RBAC policy.
    """
    eff_size = pageSize or limit or page_size
    eff_search = search or q
    eff_username = portal_username or portalUsername
    eff_start = start_date or startDate
    eff_end = end_date or endDate

    eff_page = page
    if offset is not None and page == 1:
        eff_page = (offset // eff_size) + 1 if eff_size > 0 else 1

    items, total = AuditService.list_audit_logs(
        db=db,
        page=eff_page,
        page_size=eff_size,
        search=eff_search,
        category=category,
        action=action,
        portal_username=eff_username,
        status=status,
        start_date=eff_start,
        end_date=eff_end,
    )

    total_pages = math.ceil(total / eff_size) if eff_size > 0 else 0

    return PaginatedResponse[AuditLogResponse](
        items=items,
        data=items,
        total=total,
        total_items=total,
        page=eff_page,
        page_size=eff_size,
        total_pages=total_pages,
    )


@router.get(
    "/{audit_id}",
    response_model=AuditLogResponse,
    summary="Retrieve single audit event details by ID",
)
def get_audit_log_details(
    audit_id: int,
    caller: AppUser = Depends(require_superadmin),
    db: Session = Depends(get_database),
):
    """
    Retrieve single audit log entry by ID. Restricted to SUPERADMIN callers.
    """
    from fastapi import HTTPException, status
    item = AuditService.get_audit_log_by_id(db=db, audit_id=audit_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log entry with ID {audit_id} not found",
        )
    return item

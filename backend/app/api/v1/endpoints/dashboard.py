from typing import List, Optional, Union
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_database
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    AssetsBySourceResponse,
    OwnershipSummaryResponse,
    DepartmentSummaryResponse,
    DepartmentSummaryItem,
)
from app.schemas.eol import EolSummaryResponse
from app.services.dashboard_service import DashboardService
from app.services.eol_service import EolService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    summary="Fleet Summary KPI Counts for All Pages",
)
@router.get(
    "/kpis",
    response_model=DashboardSummaryResponse,
    include_in_schema=False,
)
def get_dashboard_summary(
    source: Optional[str] = Query(None, description="Filter by discovery source (BIGFIX or JAMF)"),
    asset_status: Optional[str] = Query(None, description="Filter by asset status (Active, Need Validation, InStock)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Desktop or Server)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned user"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment type (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Search query across asset number, serial, model, username"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    # Accept and ignore pagination parameters if passed from frontend table sync
    page: Optional[int] = Query(None, include_in_schema=False),
    page_size: Optional[int] = Query(None, include_in_schema=False),
    limit: Optional[int] = Query(None, include_in_schema=False),
    offset: Optional[int] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Retrieve Fleet Summary KPI cards:
    - totalAssets
    - active
    - needValidation
    - inStock
    - nearingEol
    Aggregates directly from PostgreSQL records over the entire filtered scope.
    """
    return DashboardService.get_summary(
        db=db,
        source=source,
        asset_status=asset_status,
        devicetype=devicetype,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type,
        is_unassigned=is_unassigned,
        search=search,
        scope=scope,
    )


@router.get(
    "/assets-by-source",
    response_model=AssetsBySourceResponse,
    summary="Assets Discovery Source Breakdown",
)
def get_assets_by_source(
    source: Optional[str] = Query(None, description="Optional discovery source filter"),
    db: Session = Depends(get_database),
):
    """
    Retrieve count breakdown of BigFix versus Jamf discovered devices.
    """
    return DashboardService.get_assets_by_source(db, source=source)


@router.get(
    "/ownership-summary",
    response_model=OwnershipSummaryResponse,
    summary="Asset Ownership and Assignment Model Counts",
)
def get_ownership_summary(
    source: Optional[str] = Query(None, description="Optional discovery source filter"),
    db: Session = Depends(get_database),
):
    """
    Retrieve breakdown of automatically assigned, manually assigned, and unassigned assets.
    """
    return DashboardService.get_ownership_summary(db, source=source)


@router.get(
    "/eol-summary",
    response_model=EolSummaryResponse,
    summary="Hardware Lifecycle & EOL Summary Breakdown",
)
def get_eol_summary(
    source: Optional[str] = Query(None, description="Optional discovery source filter"),
    db: Session = Depends(get_database),
):
    """
    Retrieve lifecycle evaluation status counts: Active, Nearing EOL, Expired, and Unknown.
    """
    return EolService.get_eol_summary(db, source=source)


@router.get(
    "/department-summary",
    response_model=Union[DepartmentSummaryResponse, List[DepartmentSummaryItem]],
    summary="Department-Level Asset Summary Breakdown",
)
@router.get(
    "/department-summary/",
    response_model=Union[DepartmentSummaryResponse, List[DepartmentSummaryItem]],
    include_in_schema=False,
)
def get_department_summary(
    source: Optional[str] = Query(None, description="Optional discovery source filter (BIGFIX or JAMF)"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    as_list: bool = Query(False, description="Return raw list instead of summary object"),
    format: Optional[str] = Query(None, description="Format ('list' or 'object')"),
    db: Session = Depends(get_database),
):
    """
    Retrieve department-level asset summary correlated with Workday employees.
    Provides counts by department, status breakdowns, and sources.
    Handles unassigned assets and unmatched usernames consistently under 'Unassigned'.
    """
    result = DashboardService.get_department_summary(db, source=source, scope=scope)
    if as_list or format == "list":
        return result.items
    return result

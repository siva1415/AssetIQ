from typing import List, Optional, Union
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_database
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    AssetsBySourceResponse,
    SourceSummaryItem,
    OwnershipSummaryResponse,
    DepartmentSummaryResponse,
    DepartmentSummaryItem,
    OperationalStatusResponse,
    OperationalStatusItem,
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
    asset_status: Optional[str] = Query(None, description="Filter by asset status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
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
    response_model=Union[AssetsBySourceResponse, List[SourceSummaryItem]],
    summary="Assets Discovery Source Breakdown",
)
@router.get(
    "/assets-by-source/",
    response_model=Union[AssetsBySourceResponse, List[SourceSummaryItem]],
    include_in_schema=False,
)
@router.get(
    "/source-summary",
    response_model=Union[AssetsBySourceResponse, List[SourceSummaryItem]],
    include_in_schema=False,
)
@router.get(
    "/source-summary/",
    response_model=Union[AssetsBySourceResponse, List[SourceSummaryItem]],
    include_in_schema=False,
)
@router.get(
    "/sources",
    response_model=Union[AssetsBySourceResponse, List[SourceSummaryItem]],
    include_in_schema=False,
)
def get_assets_by_source(
    source: Optional[str] = Query(None, description="Optional discovery source filter"),
    as_list: Optional[bool] = Query(None, description="Return raw list instead of summary object", include_in_schema=False),
    format: Optional[str] = Query(None, description="Format ('list' or 'object')", include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Retrieve count breakdown of BigFix versus Jamf discovered devices.
    Returns the AssetsBySourceResponse object containing source counts and embedded source summary array.
    """
    res = DashboardService.get_assets_by_source(db, source=source)
    if as_list or format == "list":
        return res.sources or []
    return res


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
    response_model=Union[List[DepartmentSummaryItem], DepartmentSummaryResponse],
    summary="Department-Level Asset Summary Breakdown",
)
@router.get(
    "/department-summary/",
    response_model=Union[List[DepartmentSummaryItem], DepartmentSummaryResponse],
    include_in_schema=False,
)
def get_department_summary(
    source: Optional[str] = Query(None, description="Optional discovery source filter (BIGFIX or JAMF)"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    asset_status: Optional[str] = Query(None, description="Filter by asset status (Active, Need Validation, InStock)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Desktop or Server)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned user"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment type (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Search query across asset identifiers"),
    as_list: bool = Query(True, description="Return raw list instead of summary object"),
    format: Optional[str] = Query(None, description="Format ('list' or 'object')"),
    # Accept and ignore pagination parameters if passed from frontend table sync
    page: Optional[int] = Query(None, include_in_schema=False),
    page_size: Optional[int] = Query(None, include_in_schema=False),
    limit: Optional[int] = Query(None, include_in_schema=False),
    offset: Optional[int] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Retrieve department-level asset summary correlated with Workday employees.
    Provides counts by department, status breakdowns, and sources.
    Handles unassigned assets and unmatched usernames consistently under 'Unassigned'.
    Returns a top-level JSON array of department summary objects by default.
    """
    result = DashboardService.get_department_summary(
        db=db,
        source=source,
        scope=scope,
        asset_status=asset_status,
        devicetype=devicetype,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type,
        is_unassigned=is_unassigned,
        search=search,
    )
    if format == "object" and not as_list:
        return result
    return result.items


@router.get(
    "/operational-status",
    response_model=List[OperationalStatusItem],
    summary="Fleet Operational Status Breakdown",
)
@router.get(
    "/operational-status/",
    response_model=List[OperationalStatusItem],
    include_in_schema=False,
)
def get_operational_status(
    source: Optional[str] = Query(None, description="Optional discovery source filter (BIGFIX or JAMF)"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned login username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search keyword across asset identifiers"),
    as_list: Optional[bool] = Query(None, description="Return raw list instead of summary object", include_in_schema=False),
    format: Optional[str] = Query(None, description="Format ('list' or 'object')", include_in_schema=False),
    # Accept and ignore pagination parameters if passed from frontend table sync
    page: Optional[int] = Query(None, include_in_schema=False),
    page_size: Optional[int] = Query(None, include_in_schema=False),
    limit: Optional[int] = Query(None, include_in_schema=False),
    offset: Optional[int] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Retrieve counts grouped by operational status (ACTIVE, REVIEW, IN STOCK, RETIRED).
    Aggregates directly from PostgreSQL records in the assets table.
    Returns a top-level JSON array of canonical status records.
    """
    return DashboardService.get_operational_status(
        db=db,
        source=source,
        scope=scope,
        asset_status=asset_status,
        devicetype=devicetype,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type,
        is_unassigned=is_unassigned,
        search=search,
    )

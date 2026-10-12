from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import PaginationParams, get_database
from app.schemas.asset import AssetResponse, AssetDetailResponse
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.common import PaginatedResponse
from app.services.asset_service import AssetService
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get(
    "",
    response_model=PaginatedResponse[AssetResponse],
    summary="Paginated Asset Inventory with Dynamic Filtering",
)
def list_assets(
    pagination: PaginationParams = Depends(),
    source: Optional[str] = Query(None, description="Filter by discovery source (BIGFIX or JAMF)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (Active, Need Validation, InStock)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned login username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search across asset number, serial, model, username"),
    db: Session = Depends(get_database),
):
    """
    Query the enterprise hardware inventory with multi-dimensional filtering and pagination.
    """
    return AssetService.list_assets(
        db=db,
        page=pagination.page,
        page_size=pagination.page_size,
        source=source,
        asset_status=asset_status,
        devicetype=devicetype,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type,
        search=search,
        is_unassigned=is_unassigned,
    )


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    summary="Fleet Summary KPI Counts (All Assets, Windows, Mac, Ownership)",
)
@router.get(
    "/kpis",
    response_model=DashboardSummaryResponse,
    include_in_schema=False,
)
def get_assets_summary(
    source: Optional[str] = Query(None, description="Filter by discovery source (BIGFIX or JAMF)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (Active, Need Validation, InStock)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search across asset number, serial, model, username"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    # Accept and ignore pagination parameters if passed from frontend table sync
    page: Optional[int] = Query(None, include_in_schema=False),
    page_size: Optional[int] = Query(None, include_in_schema=False),
    limit: Optional[int] = Query(None, include_in_schema=False),
    offset: Optional[int] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Direct endpoint for frontend pages calling /api/assets/summary for Fleet Summary KPI cards:
    - totalAssets
    - active
    - needValidation
    - inStock
    - nearingEol
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
    "/{asset_id}",
    response_model=AssetDetailResponse,
    summary="Detailed Asset Record with Correlated Employee & EOL",
)
def get_asset_by_id(
    asset_id: int,
    db: Session = Depends(get_database),
):
    """
    Retrieve full details for an asset, correlated Workday employee profile,
    and computed hardware EOL lifecycle status.
    """
    return AssetService.get_asset_detail(db=db, asset_id=asset_id)

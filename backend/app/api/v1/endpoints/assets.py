from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import PaginationParams, get_database
from app.schemas.asset import AssetResponse, AssetDetailResponse, AssetAssignmentRequest
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    OperationalStatusResponse,
    OperationalStatusItem,
)
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
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    device_type: Optional[str] = Query(None, include_in_schema=False),
    deviceType: Optional[str] = Query(None, include_in_schema=False),
    DeviceType: Optional[str] = Query(None, include_in_schema=False),
    eol_status: Optional[str] = Query(None, description="Filter by EOL status (ACTIVE, EOL SOON, EXPIRED, UNKNOWN)"),
    eolStatus: Optional[str] = Query(None, include_in_schema=False),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned login username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model ('Auto' or 'Manual')"),
    assignmentType: Optional[str] = Query(None, include_in_schema=False),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search across asset number, serial, model, username"),
    sort_by: Optional[str] = Query(None, description="Field to sort by (e.g. last_report_time, asset_id, asset_number, model)"),
    sort_order: Optional[str] = Query("asc", description="Sort direction ('asc' or 'desc')"),
    sortBy: Optional[str] = Query(None, include_in_schema=False),
    sortOrder: Optional[str] = Query(None, include_in_schema=False),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    db: Session = Depends(get_database),
):
    """
    Query the enterprise hardware inventory with multi-dimensional filtering and pagination.
    """
    effective_devicetype = devicetype or device_type or deviceType or DeviceType
    effective_eol_status = eol_status or eolStatus
    effective_assignment_type = assignment_type or assignmentType
    effective_sort_by = sort_by or sortBy
    effective_sort_order = sort_order or sortOrder or "asc"

    # Resolve scope into discovery source if source is not explicitly supplied
    resolved_source = source
    if not resolved_source and scope:
        clean_scope = scope.strip().lower()
        if clean_scope in ["windows", "windows_assets", "bigfix"]:
            resolved_source = "BIGFIX"
        elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
            resolved_source = "JAMF"

    return AssetService.list_assets(
        db=db,
        page=pagination.page,
        page_size=pagination.page_size,
        source=resolved_source,
        asset_status=asset_status,
        devicetype=effective_devicetype,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=effective_assignment_type,
        search=search,
        is_unassigned=is_unassigned,
        eol_status=effective_eol_status,
        sort_by=effective_sort_by,
        sort_order=effective_sort_order,
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
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    device_type: Optional[str] = Query(None, include_in_schema=False),
    deviceType: Optional[str] = Query(None, include_in_schema=False),
    DeviceType: Optional[str] = Query(None, include_in_schema=False),
    eol_status: Optional[str] = Query(None, description="Filter by EOL status (ACTIVE, EOL SOON, EXPIRED, UNKNOWN)"),
    eolStatus: Optional[str] = Query(None, include_in_schema=False),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model ('Auto' or 'Manual')"),
    assignmentType: Optional[str] = Query(None, include_in_schema=False),
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
    effective_devicetype = devicetype or device_type or deviceType or DeviceType
    effective_assignment_type = assignment_type or assignmentType

    return DashboardService.get_summary(
        db=db,
        source=source,
        asset_status=asset_status,
        devicetype=effective_devicetype,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=effective_assignment_type,
        is_unassigned=is_unassigned,
        search=search,
        scope=scope,
    )


@router.get(
    "/operational-status",
    response_model=List[OperationalStatusItem],
    summary="Fleet Operational Status Breakdown (Asset Scope Alias)",
)
@router.get(
    "/operational-status/",
    response_model=List[OperationalStatusItem],
    include_in_schema=False,
)
def get_assets_operational_status(
    source: Optional[str] = Query(None, description="Filter by discovery source (BIGFIX or JAMF)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model ('Auto' or 'Manual')"),
    assignmentType: Optional[str] = Query(None, include_in_schema=False),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search across asset number, serial, model, username"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    as_list: Optional[bool] = Query(None, description="Return raw list instead of summary object", include_in_schema=False),
    format: Optional[str] = Query(None, description="Format ('list' or 'object')", include_in_schema=False),
    page: Optional[int] = Query(None, include_in_schema=False),
    page_size: Optional[int] = Query(None, include_in_schema=False),
    limit: Optional[int] = Query(None, include_in_schema=False),
    offset: Optional[int] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    effective_assignment_type = assignment_type or assignmentType
    return DashboardService.get_operational_status(
        db=db,
        source=source,
        scope=scope,
        asset_status=asset_status,
        devicetype=devicetype,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=effective_assignment_type,
        is_unassigned=is_unassigned,
        search=search,
    )


@router.get(
    "/all",
    response_model=PaginatedResponse[AssetResponse],
    summary="Retrieve ALL asset records (no pagination) for reports/exports",
)
@router.get(
    "/all/",
    response_model=PaginatedResponse[AssetResponse],
    include_in_schema=False,
)
def list_all_assets(
    source: Optional[str] = Query(None, description="Filter by discovery source (BIGFIX or JAMF)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    device_type: Optional[str] = Query(None, include_in_schema=False),
    deviceType: Optional[str] = Query(None, include_in_schema=False),
    DeviceType: Optional[str] = Query(None, include_in_schema=False),
    eol_status: Optional[str] = Query(None, description="Filter by EOL status (ACTIVE, EOL SOON, EXPIRED, UNKNOWN)"),
    eolStatus: Optional[str] = Query(None, include_in_schema=False),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned login username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model ('Auto' or 'Manual')"),
    assignmentType: Optional[str] = Query(None, include_in_schema=False),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search across asset number, serial, model, username"),
    sort_by: Optional[str] = Query(None, description="Field to sort by"),
    sort_order: Optional[str] = Query("asc", description="Sort direction ('asc' or 'desc')"),
    sortBy: Optional[str] = Query(None, include_in_schema=False),
    sortOrder: Optional[str] = Query(None, include_in_schema=False),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    db: Session = Depends(get_database),
):
    """
    Returns every asset matching the optional filters in one response (no pagination).
    Declared before '/{asset_id}' so 'all' is not parsed as an asset id.
    """
    resolved_source = source
    if not resolved_source and scope:
        clean_scope = scope.strip().lower()
        if clean_scope in ["windows", "windows_assets", "bigfix"]:
            resolved_source = "BIGFIX"
        elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
            resolved_source = "JAMF"

    return AssetService.list_all_assets(
        db=db,
        source=resolved_source,
        asset_status=asset_status,
        devicetype=devicetype or device_type or deviceType or DeviceType,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type or assignmentType,
        search=search,
        is_unassigned=is_unassigned,
        eol_status=eol_status or eolStatus,
        sort_by=sort_by or sortBy,
        sort_order=sort_order or sortOrder or "asc",
    )


@router.post(
    "/assign",
    response_model=AssetDetailResponse,
    summary="Assign Asset via Request Payload",
)
@router.put(
    "/assign",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.post(
    "/reassign",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.put(
    "/reassign",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.post(
    "/assignment",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.put(
    "/assignment",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
def assign_asset_payload(
    payload: AssetAssignmentRequest,
    db: Session = Depends(get_database),
):
    """
    Collection-level assignment endpoint for popups sending asset_id in JSON payload.
    Supports POST and PUT with exact uppercase asset_status validation.
    """
    target_id = payload.asset_id or payload.assetId or payload.AssetID
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset ID is required for assignment",
        )
    return AssetService.assign_asset(db=db, asset_id=int(target_id), payload=payload)


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


@router.post(
    "/{asset_id}/assign",
    response_model=AssetDetailResponse,
    summary="Assign or Reassign Asset to Workday Employee",
)
@router.put(
    "/{asset_id}/assign",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.post(
    "/{asset_id}/reassign",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.put(
    "/{asset_id}/reassign",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.post(
    "/{asset_id}/assignment",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
@router.put(
    "/{asset_id}/assignment",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
def assign_asset_to_employee(
    asset_id: int,
    payload: AssetAssignmentRequest,
    db: Session = Depends(get_database),
):
    """
    Assign or reassign an asset to a Workday employee with management group and remarks.
    Persists managed_by, assigned_username (workday user_id), asset_status ('ACTIVE'),
    assignment_type ('MANUAL'), and remarks.
    """
    return AssetService.assign_asset(
        db=db, asset_id=asset_id, payload=payload, is_assignment_action=True
    )


@router.put(
    "/{asset_id}",
    response_model=AssetDetailResponse,
    summary="Update Asset Assignment",
)
@router.patch(
    "/{asset_id}",
    response_model=AssetDetailResponse,
    include_in_schema=False,
)
def update_or_patch_asset(
    asset_id: int,
    payload: AssetAssignmentRequest,
    db: Session = Depends(get_database),
):
    """
    Update or partial-patch asset records, supporting nullable fields, clearing fields with null,
    and partial updates.
    """
    return AssetService.assign_asset(
        db=db, asset_id=asset_id, payload=payload, is_assignment_action=False
    )
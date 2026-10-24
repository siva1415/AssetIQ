from datetime import date
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
    HardwareAssetAnalysisResponse,
    OperatingSystemItem,
    DeviceTypeItem,
    CategoryItem,
    DeviceTypeCategoryItem,
    DeviceTypeCategoryResponse,
)
from app.schemas.eol import EolSummaryResponse
from app.services.dashboard_service import DashboardService
from app.services.eol_service import EolService
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee

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


@router.get(
    "/reports-summary",
    summary="Accurate Database Counts for All Six Reports Page Cards",
)
@router.get(
    "/reports-summary/",
    include_in_schema=False,
)
@router.get(
    "/reports/summary",
    include_in_schema=False,
)
def get_reports_summary(db: Session = Depends(get_database)):
    """
    Returns verified, accurate counts from PostgreSQL for all six Reports Page cards:
    - master_hardware
    - warranty_compliance_issues
    - bigfix_assets
    - jamf_assets
    - in_stock_inventory
    - need_validation_assets
    """
    return DashboardService.get_reports_summary(db=db)


@router.get(
    "/hardware-analysis",
    response_model=HardwareAssetAnalysisResponse,
    summary="Dashboard Hardware Asset Analysis (Operating Systems, Device Types, and Categories)",
)
@router.get(
    "/hardware-analysis/",
    response_model=HardwareAssetAnalysisResponse,
    include_in_schema=False,
)
@router.get(
    "/hardware-asset-analysis",
    response_model=HardwareAssetAnalysisResponse,
    include_in_schema=False,
)
@router.get(
    "/hardware-asset-analysis/",
    response_model=HardwareAssetAnalysisResponse,
    include_in_schema=False,
)
@router.get(
    "/hardware",
    response_model=HardwareAssetAnalysisResponse,
    include_in_schema=False,
)
def get_hardware_asset_analysis(
    source: Optional[str] = Query(None, description="Optional discovery source filter (BIGFIX or JAMF)"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    category: Optional[str] = Query(None, description="Filter by category (STORE or CORPORATE)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned login username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search keyword across asset identifiers"),
    db: Session = Depends(get_database),
):
    """
    Live, database-backed aggregated data for the Hardware Asset Analysis section:
    - Assets by Operating System (Windows 11, Windows 10, Mac)
    - Assets by Device Type (Laptops, Desktops)
    - Assets by Category (STORE, CORPORATE)
    Calculated via direct PostgreSQL GROUP BY queries excluding NULL, empty, or whitespace-only records.
    """
    return DashboardService.get_hardware_asset_analysis(
        db=db,
        source=source,
        scope=scope,
        asset_status=asset_status,
        devicetype=devicetype,
        category=category,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type,
        is_unassigned=is_unassigned,
        search=search,
    )


@router.get(
    "/assets-by-os",
    response_model=List[OperatingSystemItem],
    summary="Assets Breakdown by Operating System",
)
@router.get(
    "/assets-by-os/",
    response_model=List[OperatingSystemItem],
    include_in_schema=False,
)
@router.get(
    "/assets-by-operating-system",
    response_model=List[OperatingSystemItem],
    include_in_schema=False,
)
@router.get(
    "/os-summary",
    response_model=List[OperatingSystemItem],
    include_in_schema=False,
)
def get_assets_by_operating_system(
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
    db: Session = Depends(get_database),
):
    """
    Direct array endpoint for the Assets by Operating System doughnut chart.
    """
    analysis = DashboardService.get_hardware_asset_analysis(
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
    return analysis.operating_systems


@router.get(
    "/assets-by-device-type",
    response_model=List[DeviceTypeItem],
    summary="Assets Breakdown by Device Type",
)
@router.get(
    "/assets-by-device-type/",
    response_model=List[DeviceTypeItem],
    include_in_schema=False,
)
@router.get(
    "/assets-by-devicetype",
    response_model=List[DeviceTypeItem],
    include_in_schema=False,
)
@router.get(
    "/device-type-summary",
    response_model=List[DeviceTypeItem],
    include_in_schema=False,
)
def get_assets_by_device_type(
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
    db: Session = Depends(get_database),
):
    """
    Direct array endpoint for the Assets by Device Type doughnut chart.
    """
    analysis = DashboardService.get_hardware_asset_analysis(
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
    return analysis.device_types


@router.get(
    "/assets-by-category",
    response_model=List[CategoryItem],
    summary="Assets Breakdown by Category",
)
@router.get(
    "/assets-by-category/",
    response_model=List[CategoryItem],
    include_in_schema=False,
)
@router.get(
    "/by-category",
    response_model=List[CategoryItem],
    include_in_schema=False,
)
def get_assets_by_category(
    source: Optional[str] = Query(None, description="Optional discovery source filter (BIGFIX or JAMF)"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    category: Optional[str] = Query(None, description="Filter by category (STORE or CORPORATE)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned login username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search keyword across asset identifiers"),
    db: Session = Depends(get_database),
):
    """
    Direct array endpoint for the Assets by Category doughnut chart (STORE, CORPORATE).
    """
    analysis = DashboardService.get_hardware_asset_analysis(
        db=db,
        source=source,
        scope=scope,
        asset_status=asset_status,
        devicetype=devicetype,
        category=category,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type,
        is_unassigned=is_unassigned,
        search=search,
    )
    return analysis.categories


@router.get(
    "/by-device-type-and-category",
    response_model=Union[DeviceTypeCategoryResponse, List[DeviceTypeCategoryItem]],
    summary="Hardware Asset Analysis by Device Type and Category",
)
@router.get(
    "/by-device-type-and-category/",
    response_model=Union[DeviceTypeCategoryResponse, List[DeviceTypeCategoryItem]],
    include_in_schema=False,
)
@router.get(
    "/device-type-and-category",
    response_model=Union[DeviceTypeCategoryResponse, List[DeviceTypeCategoryItem]],
    include_in_schema=False,
)
@router.get(
    "/device-type-and-category/",
    response_model=Union[DeviceTypeCategoryResponse, List[DeviceTypeCategoryItem]],
    include_in_schema=False,
)
def get_by_device_type_and_category(
    source: Optional[str] = Query(None, description="Optional discovery source filter (BIGFIX or JAMF)"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership)"),
    asset_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assigned_username: Optional[str] = Query(None, description="Filter by assigned login username"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    search: Optional[str] = Query(None, description="Text search keyword across asset identifiers"),
    as_list: Optional[bool] = Query(None, description="Return raw list instead of wrapper object", include_in_schema=False),
    format: Optional[str] = Query(None, description="Format ('list' or 'object')", include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Live aggregated counts for the three canonical Device Type and Category combinations:
    - STORE-DESKTOPS
    - CORPORATE-LAPTOPS
    - CORPORATE-DESKTOPS
    Excludes Server devices, blank/null categories, and unsupported combinations.
    Always includes all three combinations with count 0 when no matching records exist.
    """
    res = DashboardService.get_device_type_and_category(
        db=db,
        source=source,
        scope=scope,
        asset_status=asset_status,
        manufacturer=manufacturer,
        model=model,
        assigned_username=assigned_username,
        assignment_type=assignment_type,
        is_unassigned=is_unassigned,
        search=search,
    )
    if as_list or format == "list":
        return res.byDeviceTypeAndCategory
    return res


@router.get(
    "/eol-distribution",
    summary="Dashboard EOL Lifecycle Status Distribution",
)
@router.get(
    "/eol-distribution/",
    include_in_schema=False,
)
@router.get(
    "/eol-status-distribution",
    include_in_schema=False,
)
def get_eol_distribution(
    source: Optional[str] = Query(None, description="Optional discovery source filter"),
    db: Session = Depends(get_database),
):
    """
    Returns counts for all four canonical EOL states:
    - ACTIVE: more than 90 days remaining
    - EOL SOON: 0-90 days remaining, inclusive
    - EXPIRED: EOL date before today
    - UNKNOWN: no exact manufacturer-and-model match or no usable EOL date
    Always returns all 4 states in stable order.
    """
    return DashboardService.get_eol_distribution(db=db, source=source)


@router.get(
    "/eol-exposure",
    summary="Dashboard EOL Exposure by Hardware Model",
)
@router.get(
    "/eol-exposure/",
    include_in_schema=False,
)
@router.get(
    "/eol-exposure-by-model",
    include_in_schema=False,
)
def get_eol_exposure(
    limit: int = Query(7, ge=1, le=50, description="Maximum number of models to return"),
    db: Session = Depends(get_database),
):
    """
    Preserves existing EOL Exposure by Hardware Model aggregation and business rules.
    Excludes ACTIVE hardware models, groups by exact manufacturer and model,
    and sorts by urgency (EXPIRED=0, EOL SOON=1, UNKNOWN=2), days_remaining ascending,
    and count descending.
    """
    return DashboardService.get_eol_exposure(db=db, limit=limit)


@router.get(
    "/redesign-overview",
    summary="Dashboard redesign aggregated metrics",
)
@router.get(
    "/redesign-overview/",
    include_in_schema=False,
)
def get_redesign_dashboard_overview(db: Session = Depends(get_database)):
    """
    Unified dashboard redesign aggregated metrics via direct database SQL queries
    without loading full inventory rows into Python memory.
    """
    return DashboardService.get_redesign_overview(db=db)


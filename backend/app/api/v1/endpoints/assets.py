from datetime import datetime, timezone
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.api.deps import PaginationParams, get_database, verify_admin_access
from app.schemas.asset import (
    AssetResponse,
    AssetDetailResponse,
    AssetAssignmentRequest,
    BulkAssetAssignmentRequest,
    BulkAssetAssignmentResponse,
)
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
    report: Optional[str] = Query(None, description="Report card scope (master_hardware, warranty_compliance_issues, bigfix_assets, jamf_assets, in_stock_inventory, need_validation_assets)"),
    report_name: Optional[str] = Query(None, include_in_schema=False),
    reportName: Optional[str] = Query(None, include_in_schema=False),
    report_type: Optional[str] = Query(None, include_in_schema=False),
    reportType: Optional[str] = Query(None, include_in_schema=False),
    card: Optional[str] = Query(None, include_in_schema=False),
    report_id: Optional[str] = Query(None, include_in_schema=False),
    reportId: Optional[str] = Query(None, include_in_schema=False),
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
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership, reports)"),
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

    raw_report = report or report_name or reportName or report_type or reportType or card or report_id or reportId
    clean_scope = (scope or "").strip().lower()

    REPORT_CARD_SCOPES = {
        "master_hardware", "master", "masterhardware", "master_hardware_report",
        "warranty_compliance_issues", "warranty_compliance", "warranty", "warrantycompliance", "warrantycomplianceissues", "compliance_issues", "compliance",
        "bigfix_assets", "bigfixassets",
        "jamf_assets", "jamfassets",
        "in_stock_inventory", "in_stock", "instock", "instockinventory", "in_stock_assets",
        "need_validation_assets", "need_validation", "needvalidation", "needvalidationassets",
        "reports", "report", "reports_page",
    }

    effective_report = raw_report
    if not effective_report and clean_scope in REPORT_CARD_SCOPES:
        effective_report = clean_scope

    # Resolve scope into discovery source if source is not explicitly supplied
    resolved_source = source
    if not resolved_source and clean_scope:
        if clean_scope in ["windows", "windows_assets", "bigfix"]:
            resolved_source = "BIGFIX"
        elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
            resolved_source = "JAMF"

    return AssetService.list_assets(
        db=db,
        page=pagination.page,
        page_size=pagination.page_size,
        report=effective_report,
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
    "/export",
    summary="Export Filtered Assets to CSV or XLSX",
    response_class=StreamingResponse,
)
@router.get(
    "/export.csv",
    include_in_schema=False,
)
@router.get(
    "/export/csv",
    include_in_schema=False,
)
@router.get(
    "/csv",
    include_in_schema=False,
)
@router.get(
    "/export.xlsx",
    include_in_schema=False,
)
@router.get(
    "/export/xlsx",
    include_in_schema=False,
)
@router.get(
    "/xlsx",
    include_in_schema=False,
)
def export_assets(
    request: Request,
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership, reports)"),
    report: Optional[str] = Query(None, description="Report card scope (master_hardware, warranty_compliance_issues, bigfix_assets, jamf_assets, in_stock_inventory, need_validation_assets)"),
    report_type: Optional[str] = Query(None, include_in_schema=False),
    reportType: Optional[str] = Query(None, include_in_schema=False),
    report_name: Optional[str] = Query(None, include_in_schema=False),
    reportName: Optional[str] = Query(None, include_in_schema=False),
    card: Optional[str] = Query(None, include_in_schema=False),
    report_id: Optional[str] = Query(None, include_in_schema=False),
    reportId: Optional[str] = Query(None, include_in_schema=False),
    format: Optional[str] = Query(None, description="Export file format ('xlsx' or 'csv')"),
    export_format: Optional[str] = Query(None, include_in_schema=False),
    exportFormat: Optional[str] = Query(None, include_in_schema=False),
    file_format: Optional[str] = Query(None, include_in_schema=False),
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
    search: Optional[str] = Query(None, description="Text search across asset number, serial, model, username, employee name"),
    sort_by: Optional[str] = Query(None, description="Field to sort by (e.g. last_report_time, asset_id, asset_number, model)"),
    sort_order: Optional[str] = Query("asc", description="Sort direction ('asc' or 'desc')"),
    sortBy: Optional[str] = Query(None, include_in_schema=False),
    sortOrder: Optional[str] = Query(None, include_in_schema=False),
    filename: Optional[str] = Query(None, description="Custom download filename"),
    db: Session = Depends(get_database),
):
    """
    Stream filtered hardware assets to an RFC 4180 compliant CSV or genuine XLSX file.
    - Reports page cards produce genuine .xlsx workbooks with all 18 required columns.
    - All Assets, Windows, Mac, and Ownership pages produce standard RFC 4180 CSV files.
    - Supports unlimited records (50,000+) streamed with constant memory usage.
    """
    effective_devicetype = devicetype or device_type or deviceType or DeviceType
    effective_eol_status = eol_status or eolStatus
    effective_assignment_type = assignment_type or assignmentType
    effective_sort_by = sort_by or sortBy
    effective_sort_order = sort_order or sortOrder or "asc"

    raw_report = report or report_name or reportName or report_type or reportType or card or report_id or reportId
    clean_scope = (scope or "").strip().lower()

    REPORT_CARD_SCOPES = {
        "master_hardware", "master", "masterhardware", "master_hardware_report",
        "warranty_compliance_issues", "warranty_compliance", "warranty", "warrantycompliance", "warrantycomplianceissues", "compliance_issues", "compliance",
        "bigfix_assets", "bigfixassets",
        "jamf_assets", "jamfassets",
        "in_stock_inventory", "in_stock", "instock", "instockinventory", "in_stock_assets",
        "need_validation_assets", "need_validation", "needvalidation", "needvalidationassets",
        "reports", "report", "reports_page",
    }

    effective_report = raw_report
    if not effective_report and clean_scope in REPORT_CARD_SCOPES:
        effective_report = clean_scope

    resolved_source = source
    if not resolved_source and clean_scope:
        if clean_scope in ["windows", "windows_assets", "bigfix"]:
            resolved_source = "BIGFIX"
        elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
            resolved_source = "JAMF"

    # Determine export format (xlsx vs csv)
    raw_format = (format or export_format or exportFormat or file_format or "").strip().lower()
    path_lower = request.url.path.lower()
    accept_lower = request.headers.get("accept", "").lower()

    is_xlsx = False
    if raw_format in ("xlsx", "excel", "openxml"):
        is_xlsx = True
    elif raw_format in ("csv", "text/csv"):
        is_xlsx = False
    elif path_lower.endswith(".xlsx") or "/xlsx" in path_lower:
        is_xlsx = True
    elif filename and filename.strip().lower().endswith(".xlsx"):
        is_xlsx = True
    elif "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in accept_lower or "application/vnd.ms-excel" in accept_lower:
        is_xlsx = True
    elif effective_report:
        # Default format for Reports page exports is genuine XLSX
        is_xlsx = True

    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    if is_xlsx:
        if effective_report:
            clean_rep = effective_report.strip().lower().replace("-", "_").replace(" ", "_")
            if clean_rep in ("warranty_compliance_issues", "warranty_compliance", "warranty", "compliance_issues", "compliance"):
                rep_tag = "warranty_compliance_issues"
            elif clean_rep in ("bigfix_assets", "bigfixassets", "bigfix"):
                rep_tag = "bigfix_assets"
            elif clean_rep in ("jamf_assets", "jamfassets", "jamf"):
                rep_tag = "jamf_assets"
            elif clean_rep in ("in_stock_inventory", "in_stock", "instock", "in_stock_assets"):
                rep_tag = "in_stock_inventory"
            elif clean_rep in ("need_validation_assets", "need_validation", "needvalidation", "review"):
                rep_tag = "need_validation_assets"
            else:
                rep_tag = "master_hardware"
        elif clean_scope in ["windows", "windows_assets", "bigfix"]:
            rep_tag = "windows_assets"
        elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
            rep_tag = "mac_assets"
        elif clean_scope in ["ownership", "asset_ownership"]:
            rep_tag = "asset_ownership"
        else:
            rep_tag = "all_assets"

        default_filename = f"assetiq_{rep_tag}_{today_str}.xlsx"
        download_filename = filename.strip() if (filename and filename.strip()) else default_filename
        if not download_filename.lower().endswith(".xlsx"):
            download_filename += ".xlsx"

        headers = {
            "Content-Disposition": f'attachment; filename="{download_filename}"',
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }

        return StreamingResponse(
            AssetService.generate_assets_xlsx_stream(
                db=db,
                report=effective_report,
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
            ),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    # Standard RFC 4180 CSV export for pages (All Assets, Windows, Mac, Ownership)
    if clean_scope in ["windows", "windows_assets", "bigfix"]:
        scope_tag = "windows_assets"
    elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
        scope_tag = "mac_assets"
    elif clean_scope in ["ownership", "asset_ownership"]:
        scope_tag = "asset_ownership"
    elif effective_report:
        clean_rep = effective_report.strip().lower().replace("-", "_").replace(" ", "_")
        scope_tag = clean_rep
    else:
        scope_tag = "all_assets"

    default_filename = f"assetiq_{scope_tag}_{today_str}.csv"
    download_filename = filename.strip() if (filename and filename.strip()) else default_filename
    if not download_filename.lower().endswith(".csv"):
        download_filename += ".csv"

    headers = {
        "Content-Disposition": f'attachment; filename="{download_filename}"',
        "Content-Type": "text/csv; charset=utf-8",
    }

    return StreamingResponse(
        AssetService.generate_assets_csv_stream(
            db=db,
            report=effective_report,
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
        ),
        media_type="text/csv",
        headers=headers,
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
    "/reports-summary",
    summary="Reports Page Card Counts",
)
@router.get(
    "/reports-summary/",
    include_in_schema=False,
)
@router.get(
    "/reports/counts",
    include_in_schema=False,
)
def get_assets_reports_summary(db: Session = Depends(get_database)):
    """
    Retrieves accurate database counts for all six Reports Page cards:
    1. Master Hardware
    2. Warranty Compliance Issues
    3. BigFix Assets
    4. Jamf Assets
    5. In-Stock Inventory
    6. Need-Validation Assets
    """
    return DashboardService.get_reports_summary(db=db)


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


@router.post(
    "/bulk-assign",
    response_model=BulkAssetAssignmentResponse,
    summary="Bulk Assign Multiple Hardware Assets to Active Workday Employee",
)
@router.put(
    "/bulk-assign",
    response_model=BulkAssetAssignmentResponse,
    include_in_schema=False,
)
@router.post(
    "/bulk-assignment",
    response_model=BulkAssetAssignmentResponse,
    include_in_schema=False,
)
@router.put(
    "/bulk-assignment",
    response_model=BulkAssetAssignmentResponse,
    include_in_schema=False,
)
def bulk_assign_assets(
    payload: BulkAssetAssignmentRequest,
    select_all: Optional[bool] = Query(None, description="Select all assets matching current search and filters across all pages"),
    select_all_matching: Optional[bool] = Query(None, include_in_schema=False),
    selectAll: Optional[bool] = Query(None, include_in_schema=False),
    search: Optional[str] = Query(None, description="Search keyword across asset number, serial, model, username"),
    source: Optional[str] = Query(None, description="Filter by discovery source (BIGFIX or JAMF)"),
    asset_status: Optional[str] = Query(None, description="Filter by asset status (ACTIVE, REVIEW, IN STOCK, RETIRED)"),
    devicetype: Optional[str] = Query(None, description="Filter by device type (Server or Desktop)"),
    device_type: Optional[str] = Query(None, include_in_schema=False),
    deviceType: Optional[str] = Query(None, include_in_schema=False),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    assignment_type: Optional[str] = Query(None, description="Filter by assignment model (AUTO or MANUAL)"),
    is_unassigned: Optional[bool] = Query(None, description="Filter for unassigned assets (true/false)"),
    eol_status: Optional[str] = Query(None, description="Filter by EOL lifecycle status"),
    scope: Optional[str] = Query(None, description="Page scope (all, windows, mac, ownership, reports)"),
    report: Optional[str] = Query(None, description="Report card scope"),
    current_admin: str = Depends(verify_admin_access),
    db: Session = Depends(get_database),
):
    """
    Bulk assign hardware assets to an active Workday employee.
    Requires administrative privileges (verified against admin_users table).
    Supports:
    - ID-based selection (asset_ids: [1, 2, ...])
    - Select-all matching assets across all pagination pages matching search and filters
    - Mandatory remarks handling (empty/blank replaces remarks with SQL NULL)
    - High-performance chunked updates safe for 2,000+ assets
    """
    if select_all or select_all_matching or selectAll:
        payload.select_all = True
    if search and not payload.search:
        payload.search = search
    if source and not payload.source:
        payload.source = source
    if asset_status and not payload.asset_status:
        payload.asset_status = asset_status
    eff_dev = devicetype or device_type or deviceType
    if eff_dev and not payload.devicetype:
        payload.devicetype = eff_dev
    if manufacturer and not payload.manufacturer:
        payload.manufacturer = manufacturer
    if model and not payload.model:
        payload.model = model
    if assignment_type and not payload.assignment_type:
        payload.assignment_type = assignment_type
    if is_unassigned is not None and payload.is_unassigned is None:
        payload.is_unassigned = is_unassigned
    if eol_status and not payload.eol_status:
        payload.eol_status = eol_status
    if scope and not payload.scope:
        payload.scope = scope
    if report and not payload.report:
        payload.report = report

    return AssetService.bulk_assign_assets(db=db, payload=payload)


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


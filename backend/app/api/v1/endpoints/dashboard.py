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
    "/redesign-overview",
    summary="Dashboard redesign aggregated metrics",
)
def get_redesign_dashboard_overview(db: Session = Depends(get_database)):
    """
    Additive endpoint used only by the redesigned dashboard. Existing API routes
    and response contracts are intentionally left unchanged.
    """
    assets = db.query(Asset).all()
    employees = db.query(WorkdayEmployee).all()
    eol_refs = db.query(DeviceEolReference).all()

    employee_by_user = {
        str(employee.user_id or "").strip().casefold(): employee
        for employee in employees if str(employee.user_id or "").strip()
    }
    eol_by_model = {}
    for ref in eol_refs:
        key = (str(ref.manufacturer or "").strip().casefold(), str(ref.model or "").strip().casefold())
        if key not in eol_by_model or (ref.eol_date and (not eol_by_model[key] or ref.eol_date > eol_by_model[key])):
            eol_by_model[key] = ref.eol_date

    today = date.today()
    def clean_status(value):
        raw = str(value or "").strip().upper().replace("_", " ")
        if raw in {"NEED VALIDATION", "NEEDVALIDATION", "REVIEW"}: return "REVIEW"
        if raw in {"INSTOCK", "IN STOCK"}: return "IN STOCK"
        if raw == "RETIRED": return "RETIRED"
        return "ACTIVE" if raw == "ACTIVE" else (raw or "REVIEW")

    def eol_for(asset):
        key = (str(asset.manufacturer or "").strip().casefold(), str(asset.model or "").strip().casefold())
        eol_date = eol_by_model.get(key)
        if not eol_date: return "UNKNOWN", None
        days = (eol_date - today).days
        if days < 0: return "EXPIRED", days
        if days <= 90: return "EOL SOON", days
        return "ACTIVE", days

    source_stats = {
        "BIGFIX": {"total": 0, "active": 0, "review": 0, "in_stock": 0, "retired": 0, "auto": 0, "manual": 0, "unassigned": 0, "eol_active": 0, "eol_soon": 0, "eol_expired": 0, "eol_unknown": 0},
        "JAMF": {"total": 0, "active": 0, "review": 0, "in_stock": 0, "retired": 0, "auto": 0, "manual": 0, "unassigned": 0, "eol_active": 0, "eol_soon": 0, "eol_expired": 0, "eol_unknown": 0},
    }
    status_counts = {"ACTIVE": 0, "REVIEW": 0, "IN STOCK": 0, "RETIRED": 0}
    eol_counts = {"ACTIVE": 0, "EOL SOON": 0, "EXPIRED": 0, "UNKNOWN": 0}
    departments = {}
    models = {}
    matched_owners = set()

    for asset in assets:
        source = str(asset.source or "").strip().upper()
        if source not in source_stats:
            continue
        status = clean_status(asset.asset_status)
        assign_user = str(asset.assigned_username or "").strip()
        assignment = str(asset.assignment_type or "").strip().upper()
        eol_status, days_remaining = eol_for(asset)
        stats = source_stats[source]
        stats["total"] += 1
        stats[{"ACTIVE":"active", "REVIEW":"review", "IN STOCK":"in_stock", "RETIRED":"retired"}.get(status, "review")] += 1
        status_counts[status if status in status_counts else "REVIEW"] += 1
        stats[{"ACTIVE":"eol_active", "EOL SOON":"eol_soon", "EXPIRED":"eol_expired", "UNKNOWN":"eol_unknown"}[eol_status]] += 1
        eol_counts[eol_status] += 1
        if not assign_user:
            stats["unassigned"] += 1
            assignment_label = "Unassigned"
        elif assignment == "AUTO":
            stats["auto"] += 1
            assignment_label = "Auto"
        else:
            stats["manual"] += 1
            assignment_label = "Manual"

        employee = employee_by_user.get(assign_user.casefold()) if assign_user else None
        department = str(getattr(employee, "department", "") or "").strip() if employee else ""
        if employee and assign_user:
            matched_owners.add(assign_user.casefold())
            if department:
                departments[department] = departments.get(department, 0) + 1

        model_name = f"{asset.manufacturer or 'Unknown'} {asset.model or 'Unknown'}".strip()
        model = models.setdefault(model_name, {"model": model_name, "eol_status": eol_status, "days_remaining": days_remaining, "count": 0})
        model["count"] += 1
        if model["eol_status"] == "UNKNOWN" and eol_status != "UNKNOWN":
            model["eol_status"] = eol_status
            model["days_remaining"] = days_remaining

    urgency = {"EXPIRED": 0, "EOL SOON": 1, "UNKNOWN": 2, "ACTIVE": 3}
    eol_exposure = sorted(
        (item for item in models.values() if item["eol_status"] != "ACTIVE"),
        key=lambda item: (urgency.get(item["eol_status"], 3), item["days_remaining"] if item["days_remaining"] is not None else 10**9, -item["count"]),
    )[:7]
    total_assets = len(assets)
    return {
        "kpis": {
            "total_assets": total_assets,
            "active_assets": status_counts["ACTIVE"],
            "review": status_counts["REVIEW"],
            "in_stock": status_counts["IN STOCK"],
            "employee_count": len(employees),
        },
        "assets_by_source": [
            {"source": key, "count": value["total"]} for key, value in source_stats.items()
        ],
        "eol_distribution": [
            {"status": key, "count": value} for key, value in eol_counts.items()
        ],
        "eol_exposure": eol_exposure,
        "assets_by_department": [
            {"department": key, "count": value} for key, value in sorted(departments.items(), key=lambda pair: (-pair[1], pair[0]))
        ],
        "source_summary": [
            {"source": key, **value, "active_share": round((value["eol_active"] / value["total"]) * 100) if value["total"] else 0}
            for key, value in source_stats.items()
        ],
    }
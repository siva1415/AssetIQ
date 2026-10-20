from datetime import date, timedelta
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import logger
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee
from app.repositories.eol_repository import EolRepository
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
)


class DashboardService:
    """
    Computes Fleet Summary KPI metrics and aggregates directly from PostgreSQL records.
    Calculates totalAssets, active, needValidation, inStock, and nearingEol without
    double-counting or relying on asset_status for EOL calculations.
    """

    @staticmethod
    def _get_deduplicated_eol_subquery():
        """
        Deduplicates EOL reference dates by exact manufacturer and model.
        Guarantees that at most one reference record is joined per hardware model.
        """
        return EolRepository.get_eol_subquery()

    @classmethod
    def _apply_scope_and_filters(
        cls,
        stmt,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        search: Optional[str] = None,
        scope: Optional[str] = None,
        eol_sub=None,
    ):
        """
        Applies page-level scoping, report card scopes, and active search/filter criteria.
        """
        # Resolve report card scope (Six Reports Cards)
        resolved_source = source
        resolved_status = asset_status
        effective_report = (report or "").strip().lower().replace("-", "_").replace(" ", "_")

        if effective_report:
            if effective_report in (
                "warranty_compliance_issues",
                "warranty_compliance",
                "warranty",
                "warrantycompliance",
                "warrantycomplianceissues",
                "compliance_issues",
                "compliance",
            ):
                if eol_sub is not None:
                    today = date.today()
                    warning_days = settings.EOL_WARNING_DAYS
                    warning_cutoff = today + timedelta(days=warning_days)
                    stmt = stmt.where(
                        eol_sub.c.eol_date.is_not(None),
                        eol_sub.c.eol_date <= warning_cutoff,
                    )
            elif effective_report in ("bigfix_assets", "bigfix", "bigfixassets", "windows", "windows_assets"):
                resolved_source = "BIGFIX"
            elif effective_report in ("jamf_assets", "jamf", "jamfassets", "mac", "mac_assets", "macos", "apple"):
                resolved_source = "JAMF"
            elif effective_report in ("in_stock_inventory", "in_stock", "instock", "instockinventory", "in_stock_assets"):
                resolved_status = "IN STOCK"
            elif effective_report in ("need_validation_assets", "need_validation", "needvalidation", "needvalidationassets", "review", "review_assets"):
                resolved_status = "REVIEW"
            elif effective_report in ("master_hardware", "master", "masterhardware", "all", "all_assets"):
                pass  # All assets in fleet

        # Resolve page-level scope (e.g. windows, mac, ownership)
        if scope and not effective_report:
            clean_scope = scope.strip().lower()
            if clean_scope in ["windows", "windows_assets", "bigfix"]:
                resolved_source = "BIGFIX"
            elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
                resolved_source = "JAMF"
            elif clean_scope in ["in_stock", "instock", "in_stock_inventory"]:
                resolved_status = "IN STOCK"
            elif clean_scope in ["need_validation", "needvalidation", "review"]:
                resolved_status = "REVIEW"
            elif clean_scope in ["warranty_compliance_issues", "warranty_compliance", "warranty"]:
                if eol_sub is not None:
                    today = date.today()
                    warning_days = settings.EOL_WARNING_DAYS
                    warning_cutoff = today + timedelta(days=warning_days)
                    stmt = stmt.where(
                        eol_sub.c.eol_date.is_not(None),
                        eol_sub.c.eol_date <= warning_cutoff,
                    )

        # Apply source filter (Windows -> BIGFIX, Mac -> JAMF)
        if resolved_source and resolved_source.strip().upper() != "ALL":
            src_upper = resolved_source.strip().upper()
            if src_upper in ["BIGFIX", "WINDOWS"]:
                stmt = stmt.where(func.upper(Asset.source) == "BIGFIX")
            elif src_upper in ["JAMF", "MAC", "MACOS", "APPLE"]:
                stmt = stmt.where(func.upper(Asset.source) == "JAMF")
            else:
                stmt = stmt.where(func.upper(Asset.source) == src_upper)

        if asset_status and asset_status.strip().upper() != "ALL":
            clean_status = asset_status.strip().lower()
            if clean_status in ["instock", "in stock", "in_stock"]:
                stmt = stmt.where(
                    func.lower(func.trim(Asset.asset_status)).in_(["instock", "in stock", "in_stock"])
                )
            elif clean_status in ["review", "need validation", "needvalidation", "need_validation"]:
                stmt = stmt.where(
                    func.lower(func.trim(Asset.asset_status)).in_(
                        ["review", "need validation", "needvalidation", "need_validation"]
                    )
                )
            else:
                stmt = stmt.where(func.lower(func.trim(Asset.asset_status)) == clean_status)

        if devicetype and devicetype.strip().upper() != "ALL":
            stmt = stmt.where(func.lower(Asset.devicetype) == devicetype.strip().lower())

        if manufacturer and manufacturer.strip().upper() != "ALL":
            stmt = stmt.where(func.lower(Asset.manufacturer) == manufacturer.strip().lower())

        if model and model.strip().upper() != "ALL":
            stmt = stmt.where(func.lower(Asset.model) == model.strip().lower())

        if assigned_username:
            stmt = stmt.where(
                func.lower(func.trim(Asset.assigned_username)) == assigned_username.strip().lower()
            )

        if assignment_type and assignment_type.strip().upper() != "ALL":
            clean_type = assignment_type.strip().upper()
            if clean_type in (
                "AUTO",
                "AUTOMATIC",
                "AUTOMATIC MATCH",
                "AUTOMATIC_MATCH",
                "AUTO MATCH",
                "AUTO_MATCH",
            ):
                stmt = stmt.where(func.upper(Asset.assignment_type) == "AUTO")
            elif clean_type in (
                "MANUAL",
                "MANUAL ASSIGNMENT",
                "MANUAL_ASSIGNMENT",
                "MANUAL MATCH",
                "MANUAL_MATCH",
            ):
                stmt = stmt.where(func.upper(Asset.assignment_type) == "MANUAL")
            else:
                stmt = stmt.where(func.upper(Asset.assignment_type) == clean_type)

        if is_unassigned is True:
            stmt = stmt.where(
                or_(Asset.assigned_username.is_(None), func.trim(Asset.assigned_username) == "")
            )
        elif is_unassigned is False:
            stmt = stmt.where(
                Asset.assigned_username.is_not(None), func.trim(Asset.assigned_username) != ""
            )

        if search:
            search_pat = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Asset.asset_number).like(search_pat),
                    func.lower(Asset.serial_number).like(search_pat),
                    func.lower(Asset.assigned_username).like(search_pat),
                    func.lower(Asset.model).like(search_pat),
                    func.lower(Asset.manufacturer).like(search_pat),
                )
            )

        return stmt

    @classmethod
    def get_summary(
        cls,
        db: Session,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        search: Optional[str] = None,
        scope: Optional[str] = None,
    ) -> DashboardSummaryResponse:
        """
        Executes unified PostgreSQL aggregation for Fleet Summary KPI cards:
        - totalAssets
        - active
        - needValidation
        - inStock
        - nearingEol
        - warrantyComplianceIssues
        Returns numeric 0 for empty scopes without suppressing real database failures.
        """
        today = date.today()
        warning_days = settings.EOL_WARNING_DAYS
        threshold = today + timedelta(days=warning_days)

        eol_sub = cls._get_deduplicated_eol_subquery()

        # Database aggregation query
        stmt = (
            select(
                func.count(Asset.asset_id).label("total_assets"),
                func.count(
                    case((func.lower(func.trim(Asset.asset_status)) == "active", 1), else_=None)
                ).label("active_count"),
                func.count(
                    case(
                        (
                            func.lower(func.trim(Asset.asset_status)).in_(
                                ["review", "need validation", "needvalidation", "need_validation"]
                            ),
                            1,
                        ),
                        else_=None,
                    )
                ).label("need_val_count"),
                func.count(
                    case(
                        (
                            func.lower(func.trim(Asset.asset_status)).in_(
                                ["instock", "in stock", "in_stock"]
                            ),
                            1,
                        ),
                        else_=None,
                    )
                ).label("in_stock_count"),
                func.count(
                    case(
                        (
                            eol_sub.c.eol_date.is_not(None)
                            & (eol_sub.c.eol_date >= today)
                            & (eol_sub.c.eol_date <= threshold),
                            1,
                        ),
                        else_=None,
                    )
                ).label("nearing_eol_count"),
                func.count(
                    case(
                        (
                            eol_sub.c.eol_date.is_not(None)
                            & (eol_sub.c.eol_date < today),
                            1,
                        ),
                        else_=None,
                    )
                ).label("expired_count"),
                func.count(
                    case(
                        (
                            eol_sub.c.eol_date.is_not(None)
                            & (eol_sub.c.eol_date <= threshold),
                            1,
                        ),
                        else_=None,
                    )
                ).label("warranty_compliance_issues_count"),
                func.count(
                    case((func.upper(Asset.source) == "BIGFIX", 1), else_=None)
                ).label("bigfix_count"),
                func.count(
                    case((func.upper(Asset.source) == "JAMF", 1), else_=None)
                ).label("jamf_count"),
                func.count(
                    case((func.upper(Asset.assignment_type) == "AUTO", 1), else_=None)
                ).label("auto_count"),
                func.count(
                    case((func.upper(Asset.assignment_type) == "MANUAL", 1), else_=None)
                ).label("manual_count"),
                func.count(
                    case(
                        (
                            Asset.assigned_username.is_(None)
                            | (func.trim(Asset.assigned_username) == ""),
                            1,
                        ),
                        else_=None,
                    )
                ).label("unassigned_count"),
            )
            .select_from(Asset)
            .outerjoin(
                eol_sub,
                EolRepository.get_eol_join_condition(eol_sub),
            )
        )

        # Apply page-level scoping, report card scope, and active filters
        stmt = cls._apply_scope_and_filters(
            stmt=stmt,
            report=report,
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
            eol_sub=eol_sub,
        )

        row = db.execute(stmt).first()

        total_assets = int(row.total_assets or 0) if row else 0
        active_assets = int(row.active_count or 0) if row else 0
        need_val_assets = int(row.need_val_count or 0) if row else 0
        in_stock_assets = int(row.in_stock_count or 0) if row else 0
        nearing_eol_assets = int(row.nearing_eol_count or 0) if row else 0
        expired_assets = int(row.expired_count or 0) if row else 0
        warranty_compliance_assets = int(row.warranty_compliance_issues_count or 0) if row else 0
        bigfix_assets = int(row.bigfix_count or 0) if row else 0
        jamf_assets = int(row.jamf_count or 0) if row else 0
        auto_assigned = int(row.auto_count or 0) if row else 0
        manual_assigned = int(row.manual_count or 0) if row else 0
        unassigned_assets = int(row.unassigned_count or 0) if row else 0

        # Workforce employee count
        employee_count = int(
            db.execute(select(func.count(WorkdayEmployee.employee_id))).scalar() or 0
        )

        return DashboardSummaryResponse.model_validate({
            "totalAssets": total_assets,
            "active": active_assets,
            "needValidation": need_val_assets,
            "inStock": in_stock_assets,
            "nearingEol": nearing_eol_assets,
            "total_assets": total_assets,
            "active_assets": active_assets,
            "need_validation_assets": need_val_assets,
            "in_stock_assets": in_stock_assets,
            "bigfix_assets": bigfix_assets,
            "jamf_assets": jamf_assets,
            "automatically_assigned": auto_assigned,
            "manually_assigned": manual_assigned,
            "unassigned_assets": unassigned_assets,
            "employee_count": employee_count,
            "warranty_compliance_issues": warranty_compliance_assets,
            "warranty_compliance_count": warranty_compliance_assets,
            "expired_count": expired_assets,
            "expired_assets": expired_assets,
        })

    @classmethod
    def get_reports_summary(cls, db: Session) -> dict:
        """
        Retrieves accurate database counts for all six Reports Page cards:
        1. Master Hardware
        2. Warranty Compliance Issues
        3. BigFix Assets
        4. Jamf Assets
        5. In-Stock Inventory
        6. Need-Validation Assets
        """
        summary = cls.get_summary(db=db)
        return {
            "master_hardware": summary.total_assets,
            "warranty_compliance_issues": summary.warranty_compliance_issues,
            "bigfix_assets": summary.bigfix_assets,
            "jamf_assets": summary.jamf_assets,
            "in_stock_inventory": summary.in_stock_inventory,
            "need_validation_assets": summary.need_validation_assets,
            "cards": [
                {"id": "master_hardware", "title": "Master Hardware", "count": summary.total_assets},
                {"id": "warranty_compliance_issues", "title": "Warranty Compliance Issues", "count": summary.warranty_compliance_issues},
                {"id": "bigfix_assets", "title": "BigFix Assets", "count": summary.bigfix_assets},
                {"id": "jamf_assets", "title": "Jamf Assets", "count": summary.jamf_assets},
                {"id": "in_stock_inventory", "title": "In-Stock Inventory", "count": summary.in_stock_inventory},
                {"id": "need_validation_assets", "title": "Need-Validation Assets", "count": summary.need_validation_assets},
            ],
        }

    @classmethod
    def get_assets_by_source(cls, db: Session, source: Optional[str] = None) -> AssetsBySourceResponse:
        """
        Calculates asset counts grouped by discovery source (BIGFIX, JAMF, and OTHER/unknown).
        Fetches counts from PostgreSQL assets table grouped by actual source values.
        Accurately classifies trimmed case-insensitive 'BIGFIX' and 'JAMF',
        while routing NULL, blank, or unrecognized sources to other_count.
        """
        stmt = select(
            func.upper(func.trim(Asset.source)).label("norm_source"),
            func.count(Asset.asset_id).label("source_count"),
        )
        stmt = cls._apply_scope_and_filters(stmt, source=source)
        stmt = stmt.group_by(func.upper(func.trim(Asset.source)))

        rows = db.execute(stmt).fetchall()

        bigfix_count = 0
        jamf_count = 0
        other_count = 0

        for row in rows:
            src = row.norm_source
            cnt = int(row.source_count or 0)
            if src == "BIGFIX":
                bigfix_count += cnt
            elif src == "JAMF":
                jamf_count += cnt
            else:
                other_count += cnt

        total_assets = bigfix_count + jamf_count + other_count

        return AssetsBySourceResponse.model_validate({
            "bigfix_count": bigfix_count,
            "jamf_count": jamf_count,
            "other_count": other_count,
            "total_count": total_assets,
        })

    @classmethod
    def get_ownership_summary(cls, db: Session, source: Optional[str] = None) -> OwnershipSummaryResponse:
        stmt = select(func.count(Asset.asset_id))
        stmt = cls._apply_scope_and_filters(stmt, source=source)
        total_assets = db.execute(stmt).scalar() or 0

        auto_stmt = select(func.count(Asset.asset_id)).where(func.upper(Asset.assignment_type) == "AUTO")
        auto_stmt = cls._apply_scope_and_filters(auto_stmt, source=source)
        auto_count = db.execute(auto_stmt).scalar() or 0

        manual_stmt = select(func.count(Asset.asset_id)).where(func.upper(Asset.assignment_type) == "MANUAL")
        manual_stmt = cls._apply_scope_and_filters(manual_stmt, source=source)
        manual_count = db.execute(manual_stmt).scalar() or 0

        unassigned_stmt = select(func.count(Asset.asset_id)).where(
            or_(
                Asset.assigned_username.is_(None),
                func.trim(Asset.assigned_username) == "",
            )
        )
        unassigned_stmt = cls._apply_scope_and_filters(unassigned_stmt, source=source)
        unassigned_count = db.execute(unassigned_stmt).scalar() or 0

        assigned_with_valid_user = max(0, total_assets - unassigned_count)
        other_assigned = max(0, assigned_with_valid_user - (auto_count + manual_count))

        return OwnershipSummaryResponse.model_validate({
            "auto_count": auto_count,
            "manual_count": manual_count,
            "unassigned_count": unassigned_count,
            "other_assigned_count": other_assigned,
            "total_count": total_assets,
        })

    @classmethod
    def get_department_summary(
        cls,
        db: Session,
        source: Optional[str] = None,
        scope: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> DepartmentSummaryResponse:
        """
        Calculates department-level asset distribution by joining assets with workday_employees.
        Handles:
        - Assets with no assigned user -> department: 'Unassigned'
        - Assets with user not found in Workday -> department: 'Unassigned'
        - Assets with user having null/empty department -> department: 'Unassigned'
        - Deduplication: uses distinct user_id subquery to avoid join duplication.
        - Preserves status counts (Active, Need Validation, InStock) and discovery sources (BigFix, Jamf).
        - Handles empty dataset gracefully with 0 counts.
        """
        # Deduplicated Workday employee subquery to eliminate any risk of Cartesian product / duplicates
        emp_sub = (
            select(
                func.lower(func.trim(WorkdayEmployee.user_id)).label("uid"),
                func.max(WorkdayEmployee.department).label("department"),
                func.max(WorkdayEmployee.division).label("division"),
            )
            .group_by(func.lower(func.trim(WorkdayEmployee.user_id)))
            .subquery()
        )

        dept_expr = case(
            (
                or_(
                    Asset.assigned_username.is_(None),
                    func.trim(Asset.assigned_username) == "",
                ),
                "Unassigned",
            ),
            (
                emp_sub.c.uid.is_(None),
                "Unassigned",
            ),
            (
                or_(
                    emp_sub.c.department.is_(None),
                    func.trim(emp_sub.c.department) == "",
                ),
                "Unassigned",
            ),
            else_=func.trim(emp_sub.c.department),
        ).label("department")

        stmt = (
            select(
                Asset.asset_id,
                Asset.source,
                Asset.asset_status,
                dept_expr,
                func.trim(emp_sub.c.division).label("division"),
            )
            .select_from(Asset)
            .outerjoin(
                emp_sub,
                func.lower(func.trim(Asset.assigned_username)) == emp_sub.c.uid,
            )
        )

        stmt = cls._apply_scope_and_filters(
            stmt,
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
        rows = db.execute(stmt).all()

        dept_groups: dict[str, dict] = {}

        for row in rows:
            dept_name = (row.department or "Unassigned").strip()
            if not dept_name:
                dept_name = "Unassigned"

            if dept_name not in dept_groups:
                dept_groups[dept_name] = {
                    "department": dept_name,
                    "total_assets": 0,
                    "active_assets": 0,
                    "need_validation_assets": 0,
                    "in_stock_assets": 0,
                    "bigfix_assets": 0,
                    "jamf_assets": 0,
                    "divisions": set(),
                }

            grp = dept_groups[dept_name]
            grp["total_assets"] += 1

            status_clean = (row.asset_status or "").strip().lower()
            if status_clean == "active":
                grp["active_assets"] += 1
            elif status_clean in ["review", "need validation", "needvalidation", "need_validation"]:
                grp["need_validation_assets"] += 1
            elif status_clean in ["instock", "in stock", "in_stock"]:
                grp["in_stock_assets"] += 1

            source_clean = (row.source or "").strip().upper()
            if source_clean in ["BIGFIX", "WINDOWS"]:
                grp["bigfix_assets"] += 1
            elif source_clean in ["JAMF", "MAC", "MACOS", "APPLE"]:
                grp["jamf_assets"] += 1

            if row.division and str(row.division).strip():
                grp["divisions"].add(str(row.division).strip())

        # Sort departments alphabetically, placing 'Unassigned' at the end if present
        sorted_keys = sorted(
            dept_groups.keys(),
            key=lambda k: (1 if k == "Unassigned" else 0, k.lower()),
        )

        items = []
        for k in sorted_keys:
            d = dept_groups[k]
            items.append(
                DepartmentSummaryItem.model_validate({
                    **d,
                    "divisions": sorted(list(d["divisions"])),
                })
            )

        total_assets = len(rows)
        total_departments = len(items)

        return DepartmentSummaryResponse.model_validate({
            "items": items,
            "total_departments": total_departments,
            "total_assets": total_assets,
        })

    @classmethod
    def get_operational_status(
        cls,
        db: Session,
        source: Optional[str] = None,
        scope: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[OperationalStatusItem]:
        """
        Calculates counts grouped by operational status (ACTIVE, REVIEW, IN STOCK, RETIRED)
        from actual PostgreSQL records in the assets table.
        Normalizes legacy values (e.g. 'NEED VALIDATION' -> 'REVIEW') and case variants.
        Counts each asset exactly once using mutually exclusive conditional aggregations.
        Explicitly excludes NULL and unrecognized statuses from canonical buckets.
        Returns a consistent record with numeric count (0 if no matching records) for all 4 supported statuses.
        """
        stmt = select(
            func.count(
                case(
                    (func.lower(func.trim(Asset.asset_status)) == "active", 1),
                    else_=None,
                )
            ).label("active_count"),
            func.count(
                case(
                    (
                        func.lower(func.trim(Asset.asset_status)).in_(
                            ["review", "need validation", "needvalidation", "need_validation"]
                        ),
                        1,
                    ),
                    else_=None,
                )
            ).label("review_count"),
            func.count(
                case(
                    (
                        func.lower(func.trim(Asset.asset_status)).in_(
                            ["instock", "in stock", "in_stock"]
                        ),
                        1,
                    ),
                    else_=None,
                )
            ).label("in_stock_count"),
            func.count(
                case(
                    (func.lower(func.trim(Asset.asset_status)) == "retired", 1),
                    else_=None,
                )
            ).label("retired_count"),
        ).select_from(Asset)

        stmt = cls._apply_scope_and_filters(
            stmt,
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
        row = db.execute(stmt).first()

        active = int(row.active_count or 0) if row else 0
        review = int(row.review_count or 0) if row else 0
        in_stock = int(row.in_stock_count or 0) if row else 0
        retired = int(row.retired_count or 0) if row else 0

        return [
            OperationalStatusItem(status="ACTIVE", count=active),
            OperationalStatusItem(status="REVIEW", count=review),
            OperationalStatusItem(status="IN STOCK", count=in_stock),
            OperationalStatusItem(status="RETIRED", count=retired),
        ]

    @classmethod
    def get_hardware_asset_analysis(
        cls,
        db: Session,
        source: Optional[str] = None,
        scope: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> HardwareAssetAnalysisResponse:
        """
        Computes live, database-backed aggregated metrics for the Hardware Asset Analysis card:
        1. Assets by Operating System
        2. Assets by Device Type

        Rules enforced:
        - Operating systems: grouped by os_name, trimmed, case-normalized.
          NULL, empty string, and whitespace-only records are excluded. No placeholder/unknown buckets.
          Only groups with count >= 1 are returned.
        - Device types: grouped by devicetype, trimmed, normalized casing (Desktop, Server, etc.).
          NULL, empty string, and whitespace-only records are excluded. No placeholder/unknown buckets.
          Only groups with count >= 1 are returned.
        - Accurate counts from PostgreSQL GROUP BY without fetching full inventory into memory.
        - Handles empty dataset gracefully by returning empty collections.
        """
        try:
            # 1. Total Assets in scope
            total_stmt = select(func.count(Asset.asset_id)).select_from(Asset)
            total_stmt = cls._apply_scope_and_filters(
                total_stmt,
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
            total_assets = int(db.execute(total_stmt).scalar() or 0)

            # 2. Operating Systems aggregation
            # Exclude NULL, empty string, and whitespace-only
            clean_os = func.trim(Asset.os_name)
            norm_os = func.lower(clean_os)

            os_stmt = (
                select(
                    func.max(clean_os).label("raw_os"),
                    func.count(Asset.asset_id).label("os_count"),
                )
                .select_from(Asset)
                .where(
                    Asset.os_name.is_not(None),
                    clean_os != "",
                )
            )
            os_stmt = cls._apply_scope_and_filters(
                os_stmt,
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
            os_stmt = os_stmt.group_by(norm_os).order_by(
                func.count(Asset.asset_id).desc(),
                func.max(clean_os).asc(),
            )
            os_rows = db.execute(os_stmt).fetchall()

            total_os_assets = sum(int(r.os_count or 0) for r in os_rows)
            operating_systems: List[OperatingSystemItem] = []
            for r in os_rows:
                cnt = int(r.os_count or 0)
                if cnt > 0 and r.raw_os:
                    pct = round((cnt / total_os_assets) * 100, 1) if total_os_assets > 0 else 0.0
                    operating_systems.append(
                        OperatingSystemItem(
                            name=str(r.raw_os).strip(),
                            count=cnt,
                            percentage=pct,
                        )
                    )

            # 3. Device Types aggregation
            # Exclude NULL, empty string, and whitespace-only
            clean_dev = func.trim(Asset.devicetype)
            norm_dev = func.lower(clean_dev)

            dev_stmt = (
                select(
                    func.max(clean_dev).label("raw_dev"),
                    norm_dev.label("norm_dev"),
                    func.count(Asset.asset_id).label("dev_count"),
                )
                .select_from(Asset)
                .where(
                    Asset.devicetype.is_not(None),
                    clean_dev != "",
                )
            )
            dev_stmt = cls._apply_scope_and_filters(
                dev_stmt,
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
            dev_stmt = dev_stmt.group_by(norm_dev).order_by(
                func.count(Asset.asset_id).desc(),
                norm_dev.asc(),
            )
            dev_rows = db.execute(dev_stmt).fetchall()

            total_device_assets = sum(int(r.dev_count or 0) for r in dev_rows)
            device_types: List[DeviceTypeItem] = []
            for r in dev_rows:
                cnt = int(r.dev_count or 0)
                if cnt > 0 and r.norm_dev:
                    norm_str = str(r.norm_dev).strip()
                    if norm_str == "desktop":
                        canon_name = "Desktop"
                    elif norm_str == "server":
                        canon_name = "Server"
                    elif norm_str == "laptop":
                        canon_name = "Laptop"
                    elif norm_str == "mobile":
                        canon_name = "Mobile"
                    else:
                        canon_name = str(r.raw_dev).strip().title()

                    pct = round((cnt / total_device_assets) * 100, 1) if total_device_assets > 0 else 0.0
                    device_types.append(
                        DeviceTypeItem(
                            name=canon_name,
                            count=cnt,
                            percentage=pct,
                        )
                    )

            return HardwareAssetAnalysisResponse(
                operating_systems=operating_systems,
                device_types=device_types,
                total_assets=total_assets,
                total_os_assets=total_os_assets,
                total_device_assets=total_device_assets,
            )
        except Exception as e:
            logger.error(f"Error calculating hardware asset analysis: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error executing hardware asset analysis: {str(e)}",
            )


from datetime import date, timedelta
from typing import Optional
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    AssetsBySourceResponse,
    OwnershipSummaryResponse,
    DepartmentSummaryResponse,
    DepartmentSummaryItem,
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
        Deduplicates EOL reference dates by normalized manufacturer and model.
        Guarantees that at most one reference record is joined per hardware model.
        """
        return (
            select(
                func.lower(func.trim(DeviceEolReference.manufacturer)).label("mfg"),
                func.lower(func.trim(DeviceEolReference.model)).label("mdl"),
                func.max(DeviceEolReference.eol_date).label("eol_date"),
            )
            .where(DeviceEolReference.eol_date.is_not(None))
            .group_by(
                func.lower(func.trim(DeviceEolReference.manufacturer)),
                func.lower(func.trim(DeviceEolReference.model)),
            )
            .subquery()
        )

    @classmethod
    def _apply_scope_and_filters(
        cls,
        stmt,
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
    ):
        """
        Applies page-level scoping and active search/filter criteria.
        """
        # Resolve page-level scope (e.g. windows, mac, ownership)
        resolved_source = source
        if scope:
            clean_scope = scope.strip().lower()
            if clean_scope in ["windows", "windows_assets", "bigfix"]:
                resolved_source = "BIGFIX"
            elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
                resolved_source = "JAMF"

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
            elif clean_status in ["need validation", "needvalidation", "need_validation"]:
                stmt = stmt.where(
                    func.lower(func.trim(Asset.asset_status)).in_(
                        ["need validation", "needvalidation", "need_validation"]
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
            stmt = stmt.where(func.upper(Asset.assignment_type) == assignment_type.strip().upper())

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
                                ["need validation", "needvalidation", "need_validation"]
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
                (func.lower(func.trim(Asset.manufacturer)) == eol_sub.c.mfg)
                & (func.lower(func.trim(Asset.model)) == eol_sub.c.mdl),
            )
        )

        # Apply page-level scoping and active filters
        stmt = cls._apply_scope_and_filters(
            stmt=stmt,
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

        row = db.execute(stmt).first()

        total_assets = int(row.total_assets or 0) if row else 0
        active_assets = int(row.active_count or 0) if row else 0
        need_val_assets = int(row.need_val_count or 0) if row else 0
        in_stock_assets = int(row.in_stock_count or 0) if row else 0
        nearing_eol_assets = int(row.nearing_eol_count or 0) if row else 0
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
        })

    @classmethod
    def get_assets_by_source(cls, db: Session, source: Optional[str] = None) -> AssetsBySourceResponse:
        stmt = select(func.count(Asset.asset_id))
        stmt = cls._apply_scope_and_filters(stmt, source=source)
        total_assets = db.execute(stmt).scalar() or 0

        bigfix_stmt = select(func.count(Asset.asset_id)).where(func.upper(Asset.source) == "BIGFIX")
        bigfix_stmt = cls._apply_scope_and_filters(bigfix_stmt, source=source)
        bigfix_count = db.execute(bigfix_stmt).scalar() or 0

        jamf_stmt = select(func.count(Asset.asset_id)).where(func.upper(Asset.source) == "JAMF")
        jamf_stmt = cls._apply_scope_and_filters(jamf_stmt, source=source)
        jamf_count = db.execute(jamf_stmt).scalar() or 0

        other_count = max(0, total_assets - (bigfix_count + jamf_count))

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

        stmt = cls._apply_scope_and_filters(stmt, source=source, scope=scope)
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
            elif status_clean in ["need validation", "needvalidation", "need_validation"]:
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

from datetime import date
from typing import List, Optional, Tuple
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee


class AssetRepository:
    """
    Data access repository for the `assets` table.
    Performs parameterized SQL joins with `workday_employees` and `device_eol_reference`.
    """

    @staticmethod
    def _get_eol_subquery():
        """
        Deduplicates EOL references by normalized manufacturer and model.
        """
        return (
            select(
                func.lower(func.trim(DeviceEolReference.manufacturer)).label("mfg"),
                func.lower(func.trim(DeviceEolReference.model)).label("mdl"),
                func.max(DeviceEolReference.eol_date).label("eol_date"),
                func.max(DeviceEolReference.reference_source).label("reference_source"),
            )
            .group_by(
                func.lower(func.trim(DeviceEolReference.manufacturer)),
                func.lower(func.trim(DeviceEolReference.model)),
            )
            .subquery()
        )

    @staticmethod
    def get_by_id_joined(
        db: Session, asset_id: int
    ) -> Optional[Tuple[Asset, Optional[WorkdayEmployee], Optional[date], Optional[str]]]:
        """
        Lookup single asset with parameterized outer join to WorkdayEmployee and DeviceEolReference.
        """
        eol_sub = AssetRepository._get_eol_subquery()

        stmt = (
            select(
                Asset,
                WorkdayEmployee,
                eol_sub.c.eol_date,
                eol_sub.c.reference_source,
            )
            .outerjoin(
                WorkdayEmployee,
                func.lower(func.trim(Asset.assigned_username)) == func.lower(func.trim(WorkdayEmployee.user_id)),
            )
            .outerjoin(
                eol_sub,
                and_(
                    func.lower(func.trim(Asset.manufacturer)) == eol_sub.c.mfg,
                    func.lower(func.trim(Asset.model)) == eol_sub.c.mdl,
                ),
            )
            .where(Asset.asset_id == asset_id)
        )
        return db.execute(stmt).first()

    @staticmethod
    def get_by_id(db: Session, asset_id: int) -> Optional[Asset]:
        stmt = select(Asset).where(Asset.asset_id == asset_id)
        return db.execute(stmt).scalar_one_or_none()

    @classmethod
    def _build_filter_criteria(
        cls,
        stmt: Select,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
    ) -> Select:
        # Parameterized source filter (support BIGFIX/Windows and JAMF/Mac)
        if source:
            src_upper = source.strip().upper()
            if src_upper in ["BIGFIX", "WINDOWS"]:
                stmt = stmt.where(func.upper(Asset.source) == "BIGFIX")
            elif src_upper in ["JAMF", "MAC", "MACOS", "APPLE"]:
                stmt = stmt.where(func.upper(Asset.source) == "JAMF")
            else:
                stmt = stmt.where(func.upper(Asset.source) == src_upper)

        if asset_status:
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
        if devicetype:
            stmt = stmt.where(func.lower(Asset.devicetype) == devicetype.strip().lower())
        if manufacturer:
            stmt = stmt.where(func.lower(Asset.manufacturer) == manufacturer.strip().lower())
        if model:
            stmt = stmt.where(func.lower(Asset.model) == model.strip().lower())
        if assigned_username:
            stmt = stmt.where(
                func.lower(func.trim(Asset.assigned_username)) == assigned_username.strip().lower()
            )
        if assignment_type:
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
            search_pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Asset.asset_number).like(search_pattern),
                    func.lower(Asset.serial_number).like(search_pattern),
                    func.lower(Asset.assigned_username).like(search_pattern),
                    func.lower(Asset.model).like(search_pattern),
                    func.lower(Asset.manufacturer).like(search_pattern),
                )
            )

        return stmt

    @classmethod
    def list_assets_joined(
        cls,
        db: Session,
        skip: int = 0,
        limit: int = 25,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
    ) -> Tuple[List[Tuple[Asset, Optional[WorkdayEmployee], Optional[date], Optional[str]]], int]:
        """
        Query assets with pagination and dynamic parameterized filtering,
        joining workday_employees and device_eol_reference in a single query.
        Returns a tuple of (items, total_count).
        """
        eol_sub = cls._get_eol_subquery()

        stmt = (
            select(
                Asset,
                WorkdayEmployee,
                eol_sub.c.eol_date,
                eol_sub.c.reference_source,
            )
            .outerjoin(
                WorkdayEmployee,
                func.lower(func.trim(Asset.assigned_username)) == func.lower(func.trim(WorkdayEmployee.user_id)),
            )
            .outerjoin(
                eol_sub,
                and_(
                    func.lower(func.trim(Asset.manufacturer)) == eol_sub.c.mfg,
                    func.lower(func.trim(Asset.model)) == eol_sub.c.mdl,
                ),
            )
        )

        stmt = cls._build_filter_criteria(
            stmt=stmt,
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

        # Count total matching rows from subquery
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = db.execute(count_stmt).scalar() or 0

        # Execute paginated query ordered by asset_id
        paginated_stmt = stmt.order_by(Asset.asset_id.asc()).offset(skip).limit(limit)
        results = db.execute(paginated_stmt).all()

        return [(row[0], row[1], row[2], row[3]) for row in results], total_count

    @staticmethod
    def get_assets_by_assigned_username(db: Session, user_id: str) -> List[Asset]:
        """
        Lookup all assets linked to a Workday user ID using normalized comparison.
        """
        clean_user_id = user_id.strip().lower()
        stmt = select(Asset).where(
            func.lower(func.trim(Asset.assigned_username)) == clean_user_id
        ).order_by(Asset.asset_id.asc())
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_correlated_employee(db: Session, assigned_username: Optional[str]) -> Optional[WorkdayEmployee]:
        """
        Lookup matching Workday Employee for an asset's assigned username using normalized comparison.
        """
        if not assigned_username or not assigned_username.strip():
            return None

        clean_login = assigned_username.strip().lower()
        stmt = select(WorkdayEmployee).where(
            func.lower(func.trim(WorkdayEmployee.user_id)) == clean_login
        )
        return db.execute(stmt).scalar_one_or_none()

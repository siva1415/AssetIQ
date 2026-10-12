from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee


class EolRepository:
    """
    Repository for device EOL evaluations, joins, reference CRUD, and filter discovery.
    """

    @staticmethod
    def get_eol_for_device(
        db: Session, manufacturer: Optional[str], model: Optional[str]
    ) -> Optional[DeviceEolReference]:
        if not manufacturer or not model:
            return None

        clean_mfg = manufacturer.strip().lower()
        clean_mdl = model.strip().lower()

        # Try exact normalized match first
        stmt = (
            select(DeviceEolReference)
            .where(
                func.lower(func.trim(DeviceEolReference.manufacturer)) == clean_mfg,
                func.lower(func.trim(DeviceEolReference.model)) == clean_mdl,
            )
            .order_by(DeviceEolReference.eol_date.asc())
            .limit(1)
        )
        match = db.execute(stmt).scalar_one_or_none()
        if match:
            return match

        # Try fuzzy/prefix match for manufacturer & model
        stmt_fuzzy = (
            select(DeviceEolReference)
            .where(
                func.lower(func.trim(DeviceEolReference.manufacturer)) == clean_mfg,
                or_(
                    func.lower(DeviceEolReference.model).like(f"{clean_mdl}%"),
                    func.lower(clean_mdl).like(func.lower(DeviceEolReference.model).concat("%")),
                ),
            )
            .order_by(DeviceEolReference.eol_date.asc())
            .limit(1)
        )
        return db.execute(stmt_fuzzy).scalar_one_or_none()

    @staticmethod
    def list_references(
        db: Session,
        skip: int = 0,
        limit: Optional[int] = 25,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[DeviceEolReference], int]:
        stmt = select(DeviceEolReference)

        if manufacturer:
            stmt = stmt.where(func.lower(DeviceEolReference.manufacturer) == manufacturer.strip().lower())
        if model:
            stmt = stmt.where(func.lower(DeviceEolReference.model) == model.strip().lower())
        if search:
            pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(DeviceEolReference.manufacturer).like(pattern),
                    func.lower(DeviceEolReference.model).like(pattern),
                    func.lower(DeviceEolReference.reference_source).like(pattern),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = db.execute(count_stmt).scalar() or 0

        paginated_stmt = stmt.order_by(DeviceEolReference.eol_id.asc()).offset(skip)
        if limit is not None:
            paginated_stmt = paginated_stmt.limit(limit)
        items = list(db.execute(paginated_stmt).scalars().all())

        return items, total_count

    @staticmethod
    def get_reference_by_id(db: Session, eol_id: int) -> Optional[DeviceEolReference]:
        stmt = select(DeviceEolReference).where(DeviceEolReference.eol_id == eol_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def create_reference(
        db: Session,
        manufacturer: str,
        model: str,
        eol_date: Optional[date] = None,
        reference_source: Optional[str] = None,
    ) -> DeviceEolReference:
        now = datetime.now(timezone.utc)
        record = DeviceEolReference(
            manufacturer=manufacturer.strip(),
            model=model.strip(),
            eol_date=eol_date,
            reference_source=reference_source.strip() if reference_source else None,
            created_at=now,
            updated_at=now,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def update_reference(
        db: Session,
        eol_id: int,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        eol_date: Optional[date] = None,
        reference_source: Optional[str] = None,
    ) -> Optional[DeviceEolReference]:
        record = EolRepository.get_reference_by_id(db, eol_id)
        if not record:
            return None

        if manufacturer is not None:
            record.manufacturer = manufacturer.strip()
        if model is not None:
            record.model = model.strip()
        if eol_date is not None:
            record.eol_date = eol_date
        if reference_source is not None:
            record.reference_source = reference_source.strip() if reference_source else None

        record.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def delete_reference(db: Session, eol_id: int) -> bool:
        record = EolRepository.get_reference_by_id(db, eol_id)
        if not record:
            return False

        db.delete(record)
        db.commit()
        return True

    @staticmethod
    def get_all_assets_with_eol_reference(
        db: Session,
        skip: int = 0,
        limit: int = 25,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Tuple[Asset, Optional[date], Optional[str]]], int]:
        """
        Left joins assets to device_eol_reference on normalized manufacturer and model.
        Returns a tuple of [(Asset, eol_date, reference_source)] and total matching count.
        """
        eol_sub = (
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

        stmt = (
            select(
                Asset,
                eol_sub.c.eol_date,
                eol_sub.c.reference_source,
            )
            .outerjoin(
                eol_sub,
                and_(
                    func.lower(func.trim(Asset.manufacturer)) == eol_sub.c.mfg,
                    func.lower(func.trim(Asset.model)) == eol_sub.c.mdl,
                ),
            )
        )

        if source:
            src_upper = source.strip().upper()
            if src_upper in ["BIGFIX", "WINDOWS"]:
                stmt = stmt.where(func.upper(Asset.source) == "BIGFIX")
            elif src_upper in ["JAMF", "MAC", "MACOS", "APPLE"]:
                stmt = stmt.where(func.upper(Asset.source) == "JAMF")
            else:
                stmt = stmt.where(func.upper(Asset.source) == src_upper)

        if asset_status:
            stmt = stmt.where(func.lower(Asset.asset_status) == asset_status.strip().lower())
        if devicetype:
            stmt = stmt.where(func.lower(Asset.devicetype) == devicetype.strip().lower())
        if manufacturer:
            stmt = stmt.where(func.lower(Asset.manufacturer) == manufacturer.strip().lower())
        if model:
            stmt = stmt.where(func.lower(Asset.model) == model.strip().lower())
        if search:
            pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Asset.asset_number).like(pattern),
                    func.lower(Asset.serial_number).like(pattern),
                    func.lower(Asset.assigned_username).like(pattern),
                    func.lower(Asset.model).like(pattern),
                    func.lower(Asset.manufacturer).like(pattern),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = db.execute(count_stmt).scalar() or 0

        paginated_stmt = stmt.order_by(Asset.asset_id.asc()).offset(skip).limit(limit)
        results = db.execute(paginated_stmt).all()

        return [(row[0], row[1], row[2]) for row in results], total_count

    @staticmethod
    def get_all_assets_for_eol_evaluation(
        db: Session, source: Optional[str] = None
    ) -> List[Tuple[int, Optional[str], Optional[str], Optional[date]]]:
        eol_sub = (
            select(
                func.lower(func.trim(DeviceEolReference.manufacturer)).label("mfg"),
                func.lower(func.trim(DeviceEolReference.model)).label("mdl"),
                func.max(DeviceEolReference.eol_date).label("eol_date"),
            )
            .group_by(
                func.lower(func.trim(DeviceEolReference.manufacturer)),
                func.lower(func.trim(DeviceEolReference.model)),
            )
            .subquery()
        )

        stmt = (
            select(
                Asset.asset_id,
                Asset.manufacturer,
                Asset.model,
                eol_sub.c.eol_date,
            )
            .outerjoin(
                eol_sub,
                and_(
                    func.lower(func.trim(Asset.manufacturer)) == eol_sub.c.mfg,
                    func.lower(func.trim(Asset.model)) == eol_sub.c.mdl,
                ),
            )
        )

        if source:
            src_upper = source.strip().upper()
            if src_upper in ["BIGFIX", "WINDOWS"]:
                stmt = stmt.where(func.upper(Asset.source) == "BIGFIX")
            elif src_upper in ["JAMF", "MAC", "MACOS", "APPLE"]:
                stmt = stmt.where(func.upper(Asset.source) == "JAMF")
            else:
                stmt = stmt.where(func.upper(Asset.source) == src_upper)

        results = db.execute(stmt).all()
        return [(row[0], row[1], row[2], row[3]) for row in results]

    @staticmethod
    def get_distinct_filter_values(db: Session) -> Dict[str, List[str]]:
        def fetch_distinct_non_empty(column):
            res = db.execute(
                select(column)
                .where(column.is_not(None), func.trim(column) != "")
                .distinct()
                .order_by(column.asc())
            ).scalars().all()
            return [str(val).strip() for val in res if val]

        return {
            "sources": fetch_distinct_non_empty(Asset.source),
            "asset_statuses": fetch_distinct_non_empty(Asset.asset_status),
            "device_types": fetch_distinct_non_empty(Asset.devicetype),
            "assignment_types": fetch_distinct_non_empty(Asset.assignment_type),
            "manufacturers": fetch_distinct_non_empty(Asset.manufacturer),
            "departments": fetch_distinct_non_empty(WorkdayEmployee.department),
            "divisions": fetch_distinct_non_empty(WorkdayEmployee.division),
            "employee_statuses": fetch_distinct_non_empty(WorkdayEmployee.employee_status),
        }

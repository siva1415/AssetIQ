from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple, Union
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.models.workday_employee import WorkdayEmployee
from app.repositories.eol_repository import EolRepository


class AssetRepository:
    """
    Data access repository for the `assets` table.
    Performs parameterized SQL joins with `workday_employees` and `device_eol_reference`.
    """

    @staticmethod
    def _get_eol_subquery():
        """
        Deduplicates EOL references by exact manufacturer and model.
        """
        return EolRepository.get_eol_subquery()

    @staticmethod
    def get_by_id_joined(
        db: Session, asset_id: Union[int, str]
    ) -> Optional[Tuple[Asset, Optional[WorkdayEmployee], Optional[date], Optional[str]]]:
        """
        Lookup single asset with parameterized outer join to WorkdayEmployee and DeviceEolReference.
        Accepts integer asset_id or string asset_number.
        """
        eol_sub = EolRepository.get_eol_subquery()

        if isinstance(asset_id, int):
            where_clause = (Asset.asset_id == asset_id)
        else:
            clean = str(asset_id).strip()
            if clean.isdigit():
                where_clause = (Asset.asset_id == int(clean))
            else:
                where_clause = (func.lower(func.trim(Asset.asset_number)) == clean.lower())

        stmt = (
            select(
                Asset,
                WorkdayEmployee,
                eol_sub.c.eol_date.label("eol_date"),
                eol_sub.c.reference_source.label("reference_source"),
            )
            .outerjoin(
                WorkdayEmployee,
                func.lower(func.trim(Asset.assigned_username)) == func.lower(func.trim(WorkdayEmployee.user_id)),
            )
            .outerjoin(
                eol_sub,
                EolRepository.get_eol_join_condition(eol_sub),
            )
            .where(where_clause)
        )
        return db.execute(stmt).first()

    @staticmethod
    def get_by_id(db: Session, asset_id: Union[int, str]) -> Optional[Asset]:
        """
        Lookup single asset by primary key ID or asset_number tag.
        """
        if isinstance(asset_id, int):
            stmt = select(Asset).where(Asset.asset_id == asset_id)
            return db.execute(stmt).scalar_one_or_none()
        clean = str(asset_id).strip()
        if clean.isdigit():
            found = db.execute(select(Asset).where(Asset.asset_id == int(clean))).scalar_one_or_none()
            if found:
                return found
        stmt = select(Asset).where(func.lower(func.trim(Asset.asset_number)) == clean.lower())
        return db.execute(stmt).scalar_one_or_none()

    @classmethod
    def _build_filter_criteria(
        cls,
        stmt: Select,
        eol_sub=None,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        category: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
    ) -> Select:
        # 1. Report Card Scope Resolution (Six Reports Cards)
        if report:
            clean_rep = report.strip().lower().replace("-", "_").replace(" ", "_")
            if clean_rep in (
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
                    warning_cutoff = today + timedelta(days=settings.EOL_WARNING_DAYS)
                    # Non-compliant warranty/lifecycle: expired or nearing EOL threshold
                    stmt = stmt.where(
                        eol_sub.c.eol_date.is_not(None),
                        eol_sub.c.eol_date <= warning_cutoff,
                    )
            elif clean_rep in ("bigfix_assets", "bigfix", "bigfixassets", "windows", "windows_assets"):
                stmt = stmt.where(func.upper(Asset.source) == "BIGFIX")
            elif clean_rep in ("jamf_assets", "jamf", "jamfassets", "mac", "mac_assets", "macos", "apple"):
                stmt = stmt.where(func.upper(Asset.source) == "JAMF")
            elif clean_rep in ("in_stock_inventory", "in_stock", "instock", "instockinventory", "in_stock_assets"):
                stmt = stmt.where(
                    Asset.asset_status.is_not(None),
                    func.lower(func.trim(Asset.asset_status)).in_(["instock", "in stock", "in_stock"]),
                )
            elif clean_rep in ("need_validation_assets", "need_validation", "needvalidation", "needvalidationassets", "review", "review_assets"):
                stmt = stmt.where(
                    Asset.asset_status.is_not(None),
                    func.lower(func.trim(Asset.asset_status)).in_(
                        ["review", "need validation", "needvalidation", "need_validation"]
                    ),
                )
            elif clean_rep in ("master_hardware", "master", "masterhardware", "master_hardware_report", "all", "all_assets"):
                pass  # Master Hardware represents all assets in fleet

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
                    Asset.asset_status.is_not(None),
                    func.lower(func.trim(Asset.asset_status)).in_(["instock", "in stock", "in_stock"]),
                )
            elif clean_status in ["review", "need validation", "needvalidation", "need_validation"]:
                stmt = stmt.where(
                    Asset.asset_status.is_not(None),
                    func.lower(func.trim(Asset.asset_status)).in_(
                        ["review", "need validation", "needvalidation", "need_validation"]
                    ),
                )
            else:
                stmt = stmt.where(
                    Asset.asset_status.is_not(None),
                    func.lower(func.trim(Asset.asset_status)) == clean_status,
                )

        if devicetype:
            stmt = stmt.where(Asset.devicetype.is_not(None), func.lower(Asset.devicetype) == devicetype.strip().lower())

        if category:
            stmt = stmt.where(Asset.category.is_not(None), func.lower(func.trim(Asset.category)) == category.strip().lower())

        if eol_status and eol_sub is not None:
            clean_eol = eol_status.strip().upper()
            today = date.today()
            threshold = settings.EOL_WARNING_DAYS
            warning_cutoff = today + timedelta(days=threshold)

            if clean_eol in ("EXPIRED",):
                stmt = stmt.where(eol_sub.c.eol_date.is_not(None), eol_sub.c.eol_date < today)
            elif clean_eol in ("EOL SOON", "EOL_SOON", "EOLSOON", "NEARING EOL", "NEARING_EOL", "NEARINGEOL"):
                stmt = stmt.where(
                    eol_sub.c.eol_date.is_not(None),
                    eol_sub.c.eol_date >= today,
                    eol_sub.c.eol_date <= warning_cutoff,
                )
            elif clean_eol in ("ACTIVE",):
                stmt = stmt.where(
                    eol_sub.c.eol_date.is_not(None),
                    eol_sub.c.eol_date > warning_cutoff,
                )
            elif clean_eol in ("UNKNOWN",):
                stmt = stmt.where(eol_sub.c.eol_date.is_(None))

        if manufacturer:
            stmt = stmt.where(Asset.manufacturer.is_not(None), func.lower(Asset.manufacturer) == manufacturer.strip().lower())
        if model:
            stmt = stmt.where(Asset.model.is_not(None), func.lower(Asset.model) == model.strip().lower())
        if assigned_username:
            stmt = stmt.where(
                Asset.assigned_username.is_not(None),
                func.lower(func.trim(Asset.assigned_username)) == assigned_username.strip().lower(),
            )
        if assignment_type:
            clean_type = assignment_type.strip().upper()
            if clean_type in ("AUTO", "AUTOMATIC", "AUTOMATIC MATCH", "AUTOMATIC_MATCH", "AUTO MATCH", "AUTO_MATCH"):
                stmt = stmt.where(Asset.assignment_type.is_not(None), func.upper(Asset.assignment_type) == "AUTO")
            elif clean_type in ("MANUAL", "MANUAL ASSIGNMENT", "MANUAL_ASSIGNMENT", "MANUAL MATCH", "MANUAL_MATCH"):
                stmt = stmt.where(Asset.assignment_type.is_not(None), func.upper(Asset.assignment_type) == "MANUAL")
            elif clean_type not in ("ALL", ""):
                stmt = stmt.where(Asset.assignment_type.is_not(None), func.upper(Asset.assignment_type) == clean_type)

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
                    and_(Asset.serial_number.is_not(None), func.lower(Asset.serial_number).like(search_pattern)),
                    and_(Asset.assigned_username.is_not(None), func.lower(Asset.assigned_username).like(search_pattern)),
                    and_(Asset.model.is_not(None), func.lower(Asset.model).like(search_pattern)),
                    and_(Asset.manufacturer.is_not(None), func.lower(Asset.manufacturer).like(search_pattern)),
                    and_(WorkdayEmployee.full_name.is_not(None), func.lower(WorkdayEmployee.full_name).like(search_pattern)),
                )
            )

        return stmt

    @classmethod
    def _build_joined_asset_query(
        cls,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        category: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ) -> Select:
        """
        Builds the canonical outer-joined query linking Asset with WorkdayEmployee and DeviceEolReference,
        applying all filter criteria and deterministic ordering.
        """
        eol_sub = cls._get_eol_subquery()

        stmt = (
            select(
                Asset,
                WorkdayEmployee,
                eol_sub.c.eol_date.label("eol_date"),
                eol_sub.c.reference_source.label("reference_source"),
            )
            .outerjoin(
                WorkdayEmployee,
                func.lower(func.trim(Asset.assigned_username)) == func.lower(func.trim(WorkdayEmployee.user_id)),
            )
            .outerjoin(
                eol_sub,
                EolRepository.get_eol_join_condition(eol_sub),
            )
        )

        stmt = cls._build_filter_criteria(
            stmt=stmt,
            eol_sub=eol_sub,
            report=report,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            category=category,
            manufacturer=manufacturer,
            model=model,
            assigned_username=assigned_username,
            assignment_type=assignment_type,
            search=search,
            is_unassigned=is_unassigned,
            eol_status=eol_status,
        )

        # Resolve sort ordering
        order_col = Asset.asset_id
        if sort_by:
            clean_sort = sort_by.strip().lower()
            if clean_sort in ("last_report_time", "lastreporttime", "last_discovery_date", "lastdiscoverydate"):
                order_col = Asset.lastreporttime
            elif clean_sort in ("asset_id", "assetid"):
                order_col = Asset.asset_id
            elif clean_sort in ("asset_number", "assetnumber"):
                order_col = Asset.asset_number
            elif clean_sort in ("serial_number", "serialnumber"):
                order_col = Asset.serial_number
            elif clean_sort in ("manufacturer",):
                order_col = Asset.manufacturer
            elif clean_sort in ("model",):
                order_col = Asset.model
            elif clean_sort in ("devicetype", "device_type"):
                order_col = Asset.devicetype
            elif clean_sort in ("category",):
                order_col = Asset.category
            elif clean_sort in ("asset_status", "assetstatus"):
                order_col = Asset.asset_status
            elif clean_sort in ("assignment_type", "assignmenttype"):
                order_col = Asset.assignment_type
            elif clean_sort in ("source",):
                order_col = Asset.source
            elif clean_sort in ("managed_by", "managedby"):
                order_col = Asset.managed_by
            elif clean_sort in ("macaddress", "mac_address", "mac"):
                order_col = Asset.macaddress
            elif clean_sort in ("os_name", "osname", "os"):
                order_col = Asset.os_name
            elif clean_sort in ("last_synced_at", "lastsyncedat"):
                order_col = Asset.last_synced_at

        is_desc = str(sort_order or "asc").strip().lower() == "desc"
        if is_desc:
            primary_order = order_col.desc().nulls_last() if hasattr(order_col, "nulls_last") else order_col.desc()
            secondary_order = Asset.asset_id.desc()
        else:
            primary_order = order_col.asc().nulls_last() if hasattr(order_col, "nulls_last") else order_col.asc()
            secondary_order = Asset.asset_id.asc()

        return stmt.order_by(primary_order, secondary_order)

    @classmethod
    def list_assets_joined(
        cls,
        db: Session,
        skip: int = 0,
        limit: int = 25,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        category: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ) -> Tuple[List[Tuple[Asset, Optional[WorkdayEmployee], Optional[date], Optional[str]]], int]:
        """
        Query assets with pagination and dynamic parameterized filtering,
        joining workday_employees and device_eol_reference in a single query.
        Returns a tuple of (items, total_count).
        """
        stmt = cls._build_joined_asset_query(
            report=report,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            category=category,
            manufacturer=manufacturer,
            model=model,
            assigned_username=assigned_username,
            assignment_type=assignment_type,
            search=search,
            is_unassigned=is_unassigned,
            eol_status=eol_status,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        # Count total matching rows from subquery
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = db.execute(count_stmt).scalar() or 0

        # Execute paginated query with deterministic secondary sort
        paginated_stmt = stmt.offset(skip).limit(limit)
        results = db.execute(paginated_stmt).all()

        return [(row[0], row[1], row[2], row[3]) for row in results], total_count

    @classmethod
    def iter_assets_joined(
        cls,
        db: Session,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        category: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ):
        """
        Streaming execution of joined assets query without pagination limits.
        Uses yield_per for memory efficiency with large datasets.
        """
        stmt = cls._build_joined_asset_query(
            report=report,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            category=category,
            manufacturer=manufacturer,
            model=model,
            assigned_username=assigned_username,
            assignment_type=assignment_type,
            search=search,
            is_unassigned=is_unassigned,
            eol_status=eol_status,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return db.execute(stmt).yield_per(1000)

    @classmethod
    def count_assets(
        cls,
        db: Session,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        category: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
    ) -> int:
        """
        Calculates exact total matching assets for any report or filter criteria
        using database-backed count without pagination or row limit truncation.
        Uses unique Asset.asset_id to avoid duplicate counting.
        """
        eol_sub = cls._get_eol_subquery()
        stmt = (
            select(func.count(Asset.asset_id))
            .select_from(Asset)
            .outerjoin(
                WorkdayEmployee,
                func.lower(func.trim(Asset.assigned_username)) == func.lower(func.trim(WorkdayEmployee.user_id)),
            )
            .outerjoin(
                eol_sub,
                EolRepository.get_eol_join_condition(eol_sub),
            )
        )
        stmt = cls._build_filter_criteria(
            stmt=stmt,
            eol_sub=eol_sub,
            report=report,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            category=category,
            manufacturer=manufacturer,
            model=model,
            assigned_username=assigned_username,
            assignment_type=assignment_type,
            search=search,
            is_unassigned=is_unassigned,
            eol_status=eol_status,
        )
        return int(db.execute(stmt).scalar() or 0)

    @classmethod
    def get_matching_asset_ids_and_numbers(
        cls,
        db: Session,
        report: Optional[str] = None,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        category: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
    ) -> List[Tuple[int, Optional[str]]]:
        """
        Retrieves (asset_id, asset_number) for all assets matching filter criteria across all pages.
        Uses distinct to guarantee deduplication and orders by asset_id asc.
        """
        eol_sub = cls._get_eol_subquery()
        stmt = (
            select(Asset.asset_id, Asset.asset_number)
            .distinct()
            .select_from(Asset)
            .outerjoin(
                WorkdayEmployee,
                func.lower(func.trim(Asset.assigned_username)) == func.lower(func.trim(WorkdayEmployee.user_id)),
            )
            .outerjoin(
                eol_sub,
                EolRepository.get_eol_join_condition(eol_sub),
            )
        )
        stmt = cls._build_filter_criteria(
            stmt=stmt,
            eol_sub=eol_sub,
            report=report,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            category=category,
            manufacturer=manufacturer,
            model=model,
            assigned_username=assigned_username,
            assignment_type=assignment_type,
            search=search,
            is_unassigned=is_unassigned,
            eol_status=eol_status,
        )
        stmt = stmt.order_by(Asset.asset_id.asc())
        rows = db.execute(stmt).fetchall()
        return [(int(r[0]), str(r[1]) if r[1] is not None else None) for r in rows]

    @staticmethod
    def get_by_id(db: Session, asset_id: Union[int, str]) -> Optional[Asset]:
        """
        Lookup single asset by primary key ID or asset_number tag.
        """
        if isinstance(asset_id, int):
            return db.get(Asset, asset_id)
        clean = str(asset_id).strip()
        if clean.isdigit():
            found = db.get(Asset, int(clean))
            if found:
                return found
        stmt = select(Asset).where(func.lower(func.trim(Asset.asset_number)) == clean.lower())
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_assets_by_assigned_username(db: Session, user_id: str) -> List[Asset]:
        """
        Lookup all assets linked to a Workday user ID using normalized comparison.
        """
        if not user_id or not user_id.strip():
            return []
        clean_user_id = user_id.strip().lower()
        stmt = select(Asset).where(
            Asset.assigned_username.is_not(None),
            func.lower(func.trim(Asset.assigned_username)) == clean_user_id,
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

    @staticmethod
    def update_assignment(
        db: Session,
        asset_id: int,
        managed_by: Optional[str] = None,
        assigned_username: Optional[str] = None,
        asset_status: Optional[str] = "ACTIVE",
        assignment_type: Optional[str] = "MANUAL",
        remarks: Optional[str] = None,
    ) -> Optional[Asset]:
        """
        Persist asset assignment updates to PostgreSQL in a single transactional step.
        """
        asset = db.get(Asset, asset_id)
        if not asset:
            return None

        asset.managed_by = managed_by
        asset.assigned_username = assigned_username
        asset.asset_status = asset_status
        asset.assignment_type = assignment_type
        if remarks is not None:
            asset.remarks = remarks
        asset.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(asset)
        return asset

from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.models.asset import Asset
from app.models.workday_employee import WorkdayEmployee
from app.repositories.asset_repository import AssetRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.eol_repository import EolRepository
from app.services.eol_service import EolService
from app.schemas.asset import AssetResponse, AssetDetailResponse, AssetAssignmentRequest
from app.schemas.employee import EmployeeSummary
from app.schemas.eol import EolInfo
from app.schemas.common import PaginatedResponse



class AssetService:
    """
    Business logic for Asset intelligence, parameterized search, Workday HCM correlation,
    and hardware lifecycle governance.
    """

    @classmethod
    def resolve_workday_correlation(
        cls,
        assigned_username: Optional[str],
        matched_employee: Optional[WorkdayEmployee],
    ) -> tuple[str, str]:
        """
        Distinguishes the three required Workday ownership states:
        1. "No assigned username" (UNASSIGNED)
        2. "Matched Workday employee" (MATCHED_WORKDAY) - even if inactive
        3. "Username not found in Workday" (NOT_IN_WORKDAY)
        """
        if not assigned_username or not assigned_username.strip():
            return "No assigned username", "UNASSIGNED"

        if matched_employee is not None:
            return "Matched Workday employee", "MATCHED_WORKDAY"

        return "Username not found in Workday", "NOT_IN_WORKDAY"

    @classmethod
    def build_asset_response(
        cls,
        db: Session,
        asset: Asset,
        matched_emp: Optional[WorkdayEmployee],
        eol_date: Optional[any] = None,
        ref_source: Optional[str] = None,
        skip_eol_lookup: bool = False,
    ) -> AssetResponse:
        """
        Assembles an AssetResponse with all field aliases and joined Workday & EOL metadata.
        """
        # Resolve EOL information
        if eol_date is None and ref_source is None and not skip_eol_lookup:
            # Exact lookup fallback if query was executed without pre-joining EOL table
            eol_ref = EolRepository.get_eol_for_device(db, asset.manufacturer, asset.model)
            if eol_ref:
                eol_date = eol_ref.eol_date
                ref_source = eol_ref.reference_source

        eol_status, days_rem = EolService.calculate_eol(eol_date)
        eol_info = EolInfo(
            eol_date=eol_date,
            days_remaining=days_rem,
            eol_status=eol_status,
            reference_source=ref_source,
        )

        # Resolve Workday ownership correlation
        workday_status, ownership_status = cls.resolve_workday_correlation(
            asset.assigned_username, matched_emp
        )

        emp_summary = None
        if matched_emp:
            emp_summary = EmployeeSummary.model_validate(matched_emp)

        # Assemble canonical dictionary with exactly one property per logical field
        payload = {
            "asset_id": asset.asset_id,
            "asset_number": asset.asset_number,
            "serial_number": asset.serial_number,
            "source": asset.source,
            "manufacturer": asset.manufacturer,
            "model": asset.model,
            "os_name": asset.os_name,
            "macaddress": asset.macaddress,
            "devicetype": asset.devicetype,
            "managed_by": asset.managed_by,
            "assigned_username": asset.assigned_username,
            "lastreporttime": asset.lastreporttime,
            "asset_status": asset.asset_status,
            "assignment_type": asset.assignment_type,
            "remarks": asset.remarks,
            # EOL Lifecycle Governance
            "eol_date": eol_date,
            "days_remaining": days_rem,
            "eol_status": eol_status,
            "reference_source": ref_source,
            "eol_info": eol_info,
            # Workday HCM Ownership
            "workday_status": workday_status,
            "ownership_status": ownership_status,
            # Correlated Employee Details
            "full_name": matched_emp.full_name if matched_emp else None,
            "employee_user_id": matched_emp.user_id if matched_emp else None,
            "email_work": matched_emp.email_work if matched_emp else None,
            "department": matched_emp.department if matched_emp else None,
            "division": matched_emp.division if matched_emp else None,
            "job_title": matched_emp.job_title if matched_emp else None,
            "employee_status": matched_emp.employee_status if matched_emp else None,
            "manager_name": matched_emp.manager_name if matched_emp else None,
            "manager_user_name": matched_emp.manager_user_name if matched_emp else None,
            "location": matched_emp.location if matched_emp else None,
            "matched_employee": emp_summary,
            # Audit Timestamps
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
            "last_synced_at": asset.last_synced_at,
        }
        return AssetResponse.model_validate(payload)

    @classmethod
    def get_asset_detail(cls, db: Session, asset_id: int) -> AssetDetailResponse:
        row = AssetRepository.get_by_id_joined(db, asset_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID {asset_id} not found",
            )

        asset, matched_emp, eol_date, ref_source = row
        resp = cls.build_asset_response(db, asset, matched_emp, eol_date, ref_source)
        return AssetDetailResponse.model_validate(resp.model_dump())

    @classmethod
    def normalize_assignment_type_filter(cls, val: Optional[str]) -> Optional[str]:
        """
        Normalizes assignment_type query parameter to canonical DB values 'AUTO' or 'MANUAL'.
        Supported values (case-insensitive):
        - Auto, Automatic, Automatic Match, AUTO -> 'AUTO'
        - Manual, Manual Assignment, MANUAL -> 'MANUAL'
        - ALL, None, '' -> None (no filter applied)
        Raises HTTPException 422 for unsupported values.
        """
        if val is None:
            return None
        clean = val.strip()
        if not clean or clean.upper() == "ALL":
            return None

        upper = clean.upper()
        if upper in ("AUTO", "AUTOMATIC", "AUTOMATIC MATCH", "AUTOMATIC_MATCH", "AUTO MATCH", "AUTO_MATCH"):
            return "AUTO"
        elif upper in ("MANUAL", "MANUAL ASSIGNMENT", "MANUAL_ASSIGNMENT", "MANUAL MATCH", "MANUAL_MATCH"):
            return "MANUAL"
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid assignment_type '{val}'. Supported values are 'Auto' (Automatic Match) or 'Manual' (Manual Assignment).",
            )

    @classmethod
    def list_assets(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ) -> PaginatedResponse[AssetResponse]:
        normalized_assignment_type = cls.normalize_assignment_type_filter(assignment_type)

        skip = (page - 1) * page_size
        results, total_count = AssetRepository.list_assets_joined(
            db=db,
            skip=skip,
            limit=page_size,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            manufacturer=manufacturer,
            model=model,
            assigned_username=assigned_username,
            assignment_type=normalized_assignment_type,
            search=search,
            is_unassigned=is_unassigned,
            eol_status=eol_status,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        items: list[AssetResponse] = []
        for asset, matched_emp, eol_date, ref_source in results:
            # The joined query already resolved the EOL reference; skip the per-row lookup (N+1).
            item = cls.build_asset_response(db, asset, matched_emp, eol_date, ref_source, skip_eol_lookup=True)
            items.append(item)

        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0

        return PaginatedResponse(
            items=items,
            total=total_count,
            total_items=total_count,
            total_pages=total_pages,
            page=page,
            page_size=page_size,
        )

    @classmethod
    def list_all_assets(
        cls,
        db: Session,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        assigned_username: Optional[str] = None,
        assignment_type: Optional[str] = None,
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ) -> PaginatedResponse[AssetResponse]:
        """
        Return EVERY asset matching the filters in a single query (no pagination),
        wrapped in the same PaginatedResponse envelope as list_assets.
        """
        normalized_assignment_type = cls.normalize_assignment_type_filter(assignment_type)

        results, total_count = AssetRepository.list_assets_joined(
            db=db,
            skip=0,
            limit=None,  # no LIMIT clause -> all rows
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            manufacturer=manufacturer,
            model=model,
            assigned_username=assigned_username,
            assignment_type=normalized_assignment_type,
            search=search,
            is_unassigned=is_unassigned,
            eol_status=eol_status,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        items: list[AssetResponse] = [
            cls.build_asset_response(db, asset, matched_emp, eol_date, ref_source, skip_eol_lookup=True)
            for asset, matched_emp, eol_date, ref_source in results
        ]

        count = len(items)
        return PaginatedResponse(
            items=items,
            total=count,
            total_items=count,
            total_pages=1 if count > 0 else 0,
            page=1,
            page_size=max(count, 1),  # schema requires page_size >= 1
        )

    @classmethod
    def assign_asset(
        cls,
        db: Session,
        asset_id: int,
        payload: AssetAssignmentRequest,
        is_assignment_action: bool = True,
    ) -> AssetDetailResponse:
        """
        Assign or reassign an asset to an employee or management group,
        or update/patch asset fields including nullable fields.
        """
        # 1. Validate that the target asset exists
        asset = AssetRepository.get_by_id(db, asset_id)
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID {asset_id} not found",
            )

        fields_set = payload.model_fields_set

        # 2. Check employee assignment fields
        user_val = (
            payload.assigned_username
            or payload.assignedUsername
            or payload.user_id
            or payload.userId
            or payload.username
        )
        emp_id_val = payload.employee_id or payload.employeeId

        user_fields_present = bool(
            {"assigned_username", "assignedUsername", "user_id", "userId", "username", "employee_id", "employeeId"}
            & fields_set
        )

        target_user_id = asset.assigned_username

        if user_fields_present:
            if emp_id_val is not None:
                emp = EmployeeRepository.get_by_id(db, emp_id_val)
                if not emp:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Workday employee with ID {emp_id_val} not found",
                    )
                if emp.employee_status and emp.employee_status.strip().lower() in ("terminated", "inactive", "separated"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Employee '{emp.user_id}' has status '{emp.employee_status}' and cannot be assigned hardware assets",
                    )
                target_user_id = emp.user_id
            elif user_val is not None and str(user_val).strip():
                clean_user = str(user_val).strip()
                emp = EmployeeRepository.get_by_user_id(db, clean_user)
                if not emp:
                    stmt_email = select(WorkdayEmployee).where(
                        func.lower(func.trim(WorkdayEmployee.email_work)) == clean_user.lower()
                    )
                    emp = db.execute(stmt_email).scalar_one_or_none()
                if not emp:
                    stmt_name = select(WorkdayEmployee).where(
                        func.lower(func.trim(WorkdayEmployee.full_name)) == clean_user.lower()
                    )
                    emp = db.execute(stmt_name).scalar_one_or_none()
                if not emp:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Workday employee '{clean_user}' not found",
                    )
                if emp.employee_status and emp.employee_status.strip().lower() in ("terminated", "inactive", "separated"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Employee '{emp.user_id}' has status '{emp.employee_status}' and cannot be assigned hardware assets",
                    )
                target_user_id = emp.user_id
            else:
                target_user_id = None
        elif is_assignment_action:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workday employee identifier (user_id or employee_id) is required for assignment",
            )

        # 3. Validate managed_by
        managed_fields_present = bool(
            {"managed_by", "managedBy", "management_group", "managementGroup"} & fields_set
        )
        raw_managed = (
            payload.managed_by
            or payload.managedBy
            or payload.management_group
            or payload.managementGroup
        )
        if managed_fields_present:
            if raw_managed is not None and str(raw_managed).strip():
                clean_managed = str(raw_managed).strip().upper()
                if clean_managed not in ("INDIVIDUAL", "GROUP"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid managed_by '{raw_managed}'. Allowed values are 'INDIVIDUAL' or 'GROUP'.",
                    )
                asset.managed_by = clean_managed
            else:
                asset.managed_by = None
        elif is_assignment_action:
            asset.managed_by = "INDIVIDUAL"

        # 4. Resolve asset_status
        status_fields_present = bool({"asset_status", "assetStatus", "status"} & fields_set)
        raw_status = (
            payload.asset_status
            if payload.asset_status is not None
            else (payload.assetStatus if payload.assetStatus is not None else payload.status)
        )
        if status_fields_present:
            if raw_status is not None:
                if raw_status not in ("ACTIVE", "REVIEW", "IN STOCK", "RETIRED"):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid asset_status '{raw_status}'. Allowed values are: 'ACTIVE', 'REVIEW', 'IN STOCK', 'RETIRED'",
                    )
                asset.asset_status = raw_status
            else:
                asset.asset_status = None
        elif is_assignment_action:
            asset.asset_status = "ACTIVE"

        # 5. Resolve assignment_type
        type_fields_present = bool({"assignment_type", "assignmentType"} & fields_set)
        raw_type = payload.assignment_type or payload.assignmentType
        if type_fields_present:
            if raw_type is not None and str(raw_type).strip():
                clean_type = str(raw_type).strip().upper()
                if clean_type in ("AUTO", "MANUAL"):
                    asset.assignment_type = clean_type
                else:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid assignment_type '{raw_type}'. Allowed values are: 'AUTO', 'MANUAL'",
                    )
            else:
                asset.assignment_type = None
        elif is_assignment_action:
            asset.assignment_type = "MANUAL"

        # 6. Remarks: preserve existing if omitted in update
        remarks_fields_present = bool({"remarks", "remark", "notes", "comment"} & fields_set)
        raw_remarks = (
            payload.remarks
            if payload.remarks is not None
            else (
                payload.remark
                if payload.remark is not None
                else (payload.notes if payload.notes is not None else payload.comment)
            )
        )
        if remarks_fields_present:
            asset.remarks = str(raw_remarks) if raw_remarks is not None else None

        # 7. Hardware & Telemetry fields for update/patch
        if "serial_number" in fields_set:
            asset.serial_number = payload.serial_number
        if "source" in fields_set:
            asset.source = payload.source
        if "manufacturer" in fields_set:
            asset.manufacturer = payload.manufacturer
        if "model" in fields_set:
            asset.model = payload.model
        if "os_name" in fields_set:
            asset.os_name = payload.os_name
        if "macaddress" in fields_set:
            asset.macaddress = payload.macaddress
        if "devicetype" in fields_set:
            asset.devicetype = payload.devicetype
        if "lastreporttime" in fields_set:
            asset.lastreporttime = payload.lastreporttime
        if "last_synced_at" in fields_set:
            asset.last_synced_at = payload.last_synced_at

        asset.assigned_username = target_user_id
        asset.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
            db.refresh(asset)
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to commit assignment update for asset {asset_id}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while saving asset assignment",
            )

        return cls.get_asset_detail(db, asset.asset_id)
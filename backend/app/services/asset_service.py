import csv
from datetime import datetime, timezone
import io
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.models.asset import Asset
from app.models.workday_employee import WorkdayEmployee
from app.repositories.asset_repository import AssetRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.eol_repository import EolRepository
from app.services.eol_service import EolService
from app.schemas.asset import (
    AssetResponse,
    AssetDetailResponse,
    AssetAssignmentRequest,
    BulkAssetAssignmentRequest,
    BulkAssetAssignmentResponse,
    BulkAssetAssignmentItemResult,
)
from app.schemas.employee import EmployeeSummary
from app.schemas.eol import EolInfo
from app.schemas.common import PaginatedResponse

ASSET_CSV_HEADERS = [
    "Asset",
    "Source",
    "DeviceType",
    "Manufacturer",
    "Model",
    "SerialNumber",
    "Operating System",
    "MacAddress",
    "Computer ID",
    "Asset Status",
    "EOL Expiry Date",
    "EOL Status",
    "EOL Days Remaining",
    "Managed By",
    "Assigned UserID",
    "Assigned UserName",
    "Department",
]

REPORT_XLSX_HEADERS = [
    "Asset",
    "Source",
    "DeviceType",
    "Manufacturer",
    "Model",
    "SerialNumber",
    "Operating System",
    "MacAddress",
    "Computer ID",
    "Asset Status",
    "EOL Expiry Date",
    "EOL Status",
    "EOL Days Remaining",
    "Managed By",
    "Assigned UserID",
    "Assigned UserName",
    "Department",
    "Remarks",
]


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
    ) -> AssetResponse:
        """
        Assembles an AssetResponse with all field aliases and joined Workday & EOL metadata.
        """
        # Resolve EOL information
        if eol_date is None and ref_source is None:
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
        report: Optional[str] = None,
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
            report=report,
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
            item = cls.build_asset_response(db, asset, matched_emp, eol_date, ref_source)
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
                emp_status = emp.employee_status.strip().upper() if emp.employee_status else ""
                if emp_status != "ACTIVE":
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
                emp_status = emp.employee_status.strip().upper() if emp.employee_status else ""
                if emp_status != "ACTIVE":
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

    @classmethod
    def bulk_assign_assets(
        cls,
        db: Session,
        payload: BulkAssetAssignmentRequest,
    ) -> BulkAssetAssignmentResponse:
        """
        Bulk assign hardware assets to one active Workday employee.
        Supports:
        1. Individually selected asset IDs (asset_ids: [1, 2, ...]).
        2. Select-all matching assets across all pagination pages based on search and filters.

        Enforces:
        - Workday employee validation: must exist and have employee_status == 'ACTIVE'.
        - managed_by validation: must be 'INDIVIDUAL' or 'GROUP' (defaults to 'INDIVIDUAL' if omitted).
        - Mandatory remarks behavior:
            - If admin enters non-empty remarks, update assets.remarks to that value.
            - If admin leaves remarks blank (empty, whitespace, null, or omitted), update assets.remarks to SQL NULL.
            - Do not retain previous remarks when the request has blank remarks.
        - Updating assignment_type to 'MANUAL', asset_status to 'ACTIVE', and updated_at.
        - High-performance chunked updates safe for 2,000+ assets.
        - Accurate matched, requested, success, and failure counts with actionable per-asset results.
        """
        is_select_all = bool(payload.select_all)

        # 1. Selection validation
        if not is_select_all:
            if not payload.asset_ids or len(payload.asset_ids) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="At least one asset ID must be provided in asset_ids or select_all must be true",
                )

            # Validate elements are positive integers
            for aid in payload.asset_ids:
                if not isinstance(aid, int) or aid <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid asset ID '{aid}'. Asset IDs must be positive integers.",
                    )

            # Validate uniqueness of requested asset IDs
            if len(payload.asset_ids) != len(set(payload.asset_ids)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Duplicate asset IDs are not allowed in asset_ids. Each asset ID must be unique.",
                )

        # 2. Validate assigned_username
        user_val = (
            payload.assigned_username
            or payload.assignedUsername
            or payload.user_id
            or payload.userId
            or payload.username
        )
        if not user_val or not str(user_val).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="assigned_username is required for bulk asset assignment",
            )

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

        emp_status = emp.employee_status.strip().upper() if emp.employee_status else ""
        if emp_status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee '{emp.user_id}' has status '{emp.employee_status}' and cannot be assigned hardware assets",
            )

        target_user_id = emp.user_id

        # 3. Validate managed_by
        raw_managed = (
            payload.managed_by
            or payload.managedBy
            or payload.management_group
            or payload.managementGroup
        )
        if raw_managed is None:
            clean_managed = "INDIVIDUAL"
        elif not str(raw_managed).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="managed_by cannot be empty. Allowed values are 'INDIVIDUAL' or 'GROUP'.",
            )
        else:
            clean_managed = str(raw_managed).strip().upper()
            if clean_managed not in ("INDIVIDUAL", "GROUP"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid managed_by '{raw_managed}'. Allowed values are 'INDIVIDUAL' or 'GROUP'.",
                )

        # 4. Mandatory Remarks Behavior:
        # Non-empty string -> update to trimmed value;
        # Blank / whitespace / None / omitted -> update to SQL NULL (do not retain previous remarks).
        raw_remarks = (
            payload.remarks
            if payload.remarks is not None
            else (
                payload.remark
                if payload.remark is not None
                else (payload.notes if payload.notes is not None else payload.comment)
            )
        )
        clean_remarks = str(raw_remarks).strip() if (raw_remarks is not None and str(raw_remarks).strip()) else None

        now_time = datetime.now(timezone.utc)
        chunk_size = 1000

        # 5. Resolve assets to update and execute
        if not is_select_all:
            # 5A. ID-based selection
            stmt = select(Asset.asset_id, Asset.asset_number).where(Asset.asset_id.in_(payload.asset_ids))
            existing_rows = db.execute(stmt).fetchall()
            existing_map = {int(r[0]): (str(r[1]) if r[1] is not None else None) for r in existing_rows}

            valid_ids = [aid for aid in payload.asset_ids if aid in existing_map]
            missing_ids = [aid for aid in payload.asset_ids if aid not in existing_map]

            if valid_ids:
                try:
                    for i in range(0, len(valid_ids), chunk_size):
                        chunk = valid_ids[i:i + chunk_size]
                        db.execute(
                            update(Asset)
                            .where(Asset.asset_id.in_(chunk))
                            .values(
                                assigned_username=target_user_id,
                                managed_by=clean_managed,
                                assignment_type="MANUAL",
                                asset_status="ACTIVE",
                                remarks=clean_remarks,
                                updated_at=now_time,
                            )
                        )
                    db.commit()
                except Exception as exc:
                    db.rollback()
                    logger.error(f"Failed to commit bulk asset assignment batch: {exc}", exc_info=True)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Database transaction error during bulk asset assignment",
                    )

            results: list[BulkAssetAssignmentItemResult] = []
            for aid in payload.asset_ids:
                if aid in existing_map:
                    results.append(
                        BulkAssetAssignmentItemResult(
                            asset_id=aid,
                            asset_number=existing_map[aid],
                            status="SUCCESS",
                            reason=None,
                        )
                    )
                else:
                    results.append(
                        BulkAssetAssignmentItemResult(
                            asset_id=aid,
                            asset_number=None,
                            status="FAILED",
                            reason=f"Asset with ID {aid} was not found",
                        )
                    )

            requested_count = len(payload.asset_ids)
            matched_count = len(valid_ids)
            success_count = len(valid_ids)
            failure_count = len(missing_ids)

        else:
            # 5B. Select-all matching assets across all pages based on search and filters
            REPORT_CARD_SCOPES = {
                "master_hardware", "master", "masterhardware", "master_hardware_report",
                "warranty_compliance_issues", "warranty_compliance", "warranty", "warrantycompliance", "warrantycomplianceissues", "compliance_issues", "compliance",
                "bigfix_assets", "bigfixassets",
                "jamf_assets", "jamfassets",
                "in_stock_inventory", "in_stock", "instock", "instockinventory", "in_stock_assets",
                "need_validation_assets", "need_validation", "needvalidation", "needvalidationassets",
                "reports", "report", "reports_page",
            }

            clean_scope = (payload.scope or "").strip().lower()
            resolved_source = payload.source
            if not resolved_source and clean_scope:
                if clean_scope in ["windows", "windows_assets", "bigfix"]:
                    resolved_source = "BIGFIX"
                elif clean_scope in ["mac", "mac_assets", "jamf", "macos", "apple"]:
                    resolved_source = "JAMF"

            effective_report = payload.report
            if not effective_report and clean_scope in REPORT_CARD_SCOPES:
                effective_report = clean_scope

            matched_rows = AssetRepository.get_matching_asset_ids_and_numbers(
                db=db,
                report=effective_report,
                source=resolved_source,
                asset_status=payload.asset_status,
                devicetype=payload.devicetype,
                manufacturer=payload.manufacturer,
                model=payload.model,
                assigned_username=payload.filter_assigned_username,
                assignment_type=payload.assignment_type,
                search=payload.search,
                is_unassigned=payload.is_unassigned,
                eol_status=payload.eol_status,
            )

            matched_ids = [r[0] for r in matched_rows]
            matched_map = {r[0]: r[1] for r in matched_rows}
            matched_count = len(matched_ids)

            if matched_count == 0:
                return BulkAssetAssignmentResponse(
                    message="No assets matched the submitted filter criteria. 0 assets were assigned.",
                    requested_count=0,
                    matched_count=0,
                    success_count=0,
                    failure_count=0,
                    target_username=target_user_id,
                    managed_by=clean_managed,
                    assignment_type="MANUAL",
                    asset_status="ACTIVE",
                    results=[],
                )

            try:
                for i in range(0, len(matched_ids), chunk_size):
                    chunk = matched_ids[i:i + chunk_size]
                    db.execute(
                        update(Asset)
                        .where(Asset.asset_id.in_(chunk))
                        .values(
                            assigned_username=target_user_id,
                            managed_by=clean_managed,
                            assignment_type="MANUAL",
                            asset_status="ACTIVE",
                            remarks=clean_remarks,
                            updated_at=now_time,
                        )
                    )
                db.commit()
            except Exception as exc:
                db.rollback()
                logger.error(f"Failed to commit select-all bulk asset assignment: {exc}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database transaction error during bulk asset assignment",
                )

            results = [
                BulkAssetAssignmentItemResult(
                    asset_id=aid,
                    asset_number=matched_map.get(aid),
                    status="SUCCESS",
                    reason=None,
                )
                for aid in matched_ids
            ]
            requested_count = matched_count
            success_count = matched_count
            failure_count = 0

        # 6. Response message formatting
        if failure_count == 0:
            message = f"Bulk assignment completed successfully: {success_count} asset(s) assigned"
        elif success_count == 0:
            message = "Bulk assignment failed for all requested assets"
        else:
            message = f"Bulk assignment completed with some failures: {success_count} succeeded, {failure_count} failed"

        return BulkAssetAssignmentResponse(
            message=message,
            requested_count=requested_count,
            matched_count=matched_count,
            success_count=success_count,
            failure_count=failure_count,
            target_username=target_user_id,
            managed_by=clean_managed,
            assignment_type="MANUAL",
            asset_status="ACTIVE",
            results=results,
        )

    @classmethod
    def generate_assets_csv_stream(
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
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
        include_remarks: bool = False,
    ):
        """
        Stream CSV data for all assets matching dynamic search and multi-dimensional filters.
        Emits standard RFC 4180 CSV with CRLF line endings in UTF-8.
        Supports datasets of 10,000+ records via buffered streaming without memory bloat.
        """
        normalized_assignment_type = cls.normalize_assignment_type_filter(assignment_type)

        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\r\n")

        headers = REPORT_XLSX_HEADERS if (report or include_remarks) else ASSET_CSV_HEADERS

        # 1. Emit Header Row
        writer.writerow(headers)
        yield output.getvalue().encode("utf-8")
        output.seek(0)
        output.truncate(0)

        # 2. Iterate database rows using yield_per
        results = AssetRepository.iter_assets_joined(
            db=db,
            report=report,
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

        chunk_size = 500
        count = 0

        for row in results:
            asset, emp, eol_date, ref_source = row

            eol_stat, days_rem = EolService.calculate_eol(eol_date)
            eol_expiry_str = eol_date.strftime("%Y-%m-%d") if eol_date else ""
            days_rem_str = str(days_rem) if days_rem is not None else ""

            assigned_user_id = (
                asset.assigned_username.strip()
                if (asset.assigned_username and asset.assigned_username.strip())
                else ""
            )
            assigned_user_name = emp.full_name if (emp and emp.full_name) else ""
            department = emp.department if (emp and emp.department) else ""

            computer_id = (
                str(getattr(asset, "computer_id", None))
                if getattr(asset, "computer_id", None) is not None
                else ""
            )

            csv_row = [
                asset.asset_number or "",
                asset.source or "",
                asset.devicetype or "",
                asset.manufacturer or "",
                asset.model or "",
                asset.serial_number or "",
                asset.os_name or "",
                asset.macaddress or "",
                computer_id,
                asset.asset_status or "",
                eol_expiry_str,
                eol_stat,
                days_rem_str,
                asset.managed_by or "",
                assigned_user_id,
                assigned_user_name,
                department,
            ]
            if report or include_remarks:
                csv_row.append(asset.remarks or "")

            writer.writerow(csv_row)
            count += 1

            if count >= chunk_size:
                yield output.getvalue().encode("utf-8")
                output.seek(0)
                output.truncate(0)
                count = 0

        if count > 0:
            yield output.getvalue().encode("utf-8")
            output.seek(0)
            output.truncate(0)

    @classmethod
    def generate_assets_xlsx_stream(
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
        search: Optional[str] = None,
        is_unassigned: Optional[bool] = None,
        eol_status: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ):
        """
        Stream genuine .xlsx workbook containing all matching assets using
        openpyxl with write_only=True for constant memory efficiency with 50,000+ records.
        """
        import os
        import tempfile
        from openpyxl import Workbook

        normalized_assignment_type = cls.normalize_assignment_type_filter(assignment_type)

        wb = Workbook(write_only=True)
        ws = wb.create_sheet(title="Asset Inventory")

        # 1. Emit 18 required report headers in exact order
        ws.append(REPORT_XLSX_HEADERS)

        # 2. Iterate database rows using yield_per for constant-memory retrieval
        results = AssetRepository.iter_assets_joined(
            db=db,
            report=report,
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

        for row in results:
            asset, emp, eol_date, ref_source = row

            eol_stat, days_rem = EolService.calculate_eol(eol_date)
            eol_expiry_str = eol_date.strftime("%Y-%m-%d") if eol_date else ""
            days_rem_val = str(days_rem) if days_rem is not None else ""

            assigned_user_id = (
                asset.assigned_username.strip()
                if (asset.assigned_username and asset.assigned_username.strip())
                else ""
            )
            assigned_user_name = emp.full_name if (emp and emp.full_name) else ""
            department = emp.department if (emp and emp.department) else ""

            computer_id = (
                str(getattr(asset, "computer_id", None))
                if getattr(asset, "computer_id", None) is not None
                else ""
            )

            remarks = asset.remarks or ""

            xlsx_row = [
                asset.asset_number or "",
                asset.source or "",
                asset.devicetype or "",
                asset.manufacturer or "",
                asset.model or "",
                asset.serial_number or "",
                asset.os_name or "",
                asset.macaddress or "",
                computer_id,
                asset.asset_status or "",
                eol_expiry_str,
                eol_stat,
                days_rem_val,
                asset.managed_by or "",
                assigned_user_id,
                assigned_user_name,
                department,
                remarks,
            ]
            ws.append(xlsx_row)

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        tmp_path = tmp.name
        tmp.close()

        wb.save(tmp_path)
        wb.close()

        try:
            with open(tmp_path, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk
        finally:
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except OSError:
                pass



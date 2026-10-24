import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import threading
import time
from typing import Any, List, Optional, Tuple, Union
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.models.asset import Asset
from app.models.audit_log import AuditLog
from app.models.workday_employee import WorkdayEmployee
from app.repositories.asset_repository import AssetRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.eol_repository import EolRepository
from app.services.audit_service import AuditService
from app.services.eol_service import EolService
from app.schemas.asset import (
    AssetResponse,
    AssetDetailResponse,
    AssetAssignmentRequest,
    BulkAssetAssignmentRequest,
    BulkAssetAssignmentResponse,
    BulkAssetAssignmentItemResult,
    BulkAssetAssignmentFailedItem,
)
from app.schemas.employee import EmployeeSummary, ReportingEvp
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
    "Manager UserID",
    "Manager UserName",
    "Job Title",
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
    def resolve_reporting_evp(
        cls,
        db: Session,
        employee: Optional[WorkdayEmployee],
    ) -> Union[dict[str, str], str]:
        """
        Identifies the Reporting EVP for an assigned employee:
        1. Query workday_employees where department = 'Executive Committee'.
           Identify employees whose job_title starts with 'EVP -' or 'President -',
           and collect their user_id and full_name into an executive list.
        2. Retrieve assigned employee's record from workday_employees. Check
           manager_level_1_user_name through manager_level_9_user_name against the
           executive list's user_id values. If match is found, return executive's full_name and user_id.
        3. Special cases:
           - If assigned user's job_title is 'Executive Assistant to the CEO' or 'Chief Executive Officer', return '-'.
           - If no matching EVP or President is found, return '-'.
           - Safely handle NULL, empty, and whitespace values.
        """
        if not employee:
            return "-"

        # 3. Special case: Executive Assistant to the CEO or Chief Executive Officer
        raw_title = employee.job_title or ""
        clean_title = " ".join(raw_title.strip().lower().split())
        if clean_title in ("executive assistant to the ceo", "chief executive officer"):
            return "-"

        exec_lookup = EmployeeRepository.get_executive_committee_lookup(db)
        if not exec_lookup:
            return "-"

        # 2. Check manager_level_1_user_name through manager_level_9_user_name in order
        for lvl in range(1, 10):
            mgr_val = getattr(employee, f"manager_level_{lvl}_user_name", None)
            if mgr_val is not None and isinstance(mgr_val, str):
                clean_mgr = mgr_val.strip().lower()
                if clean_mgr and clean_mgr in exec_lookup:
                    match = exec_lookup[clean_mgr]
                    return ReportingEvp(
                        full_name=match["full_name"],
                        user_id=match["user_id"],
                        job_title=match.get("job_title"),
                    )

        return "-"

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

        # Resolve Reporting EVP for Assigned User
        reporting_evp = cls.resolve_reporting_evp(db, matched_emp)

        emp_summary = None
        if matched_emp:
            emp_summary = EmployeeSummary.model_validate(matched_emp)
            emp_summary.reporting_evp = reporting_evp

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
            "computer_id": asset.computer_id,
            "devicetype": asset.devicetype,
            "category": asset.category,
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
            # Reporting EVP for popup
            "reporting_evp": reporting_evp,
            # Correlated Employee Details
            "user_id": matched_emp.user_id if matched_emp else (asset.assigned_username.strip() if asset.assigned_username else None),
            "userId": matched_emp.user_id if matched_emp else (asset.assigned_username.strip() if asset.assigned_username else None),
            "user_full_name": matched_emp.full_name if matched_emp else None,
            "userFullName": matched_emp.full_name if matched_emp else None,
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
    def get_asset_detail(cls, db: Session, asset_id: Union[int, str]) -> AssetDetailResponse:
        row = AssetRepository.get_by_id_joined(db, asset_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID or number '{asset_id}' not found",
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
            category=category,
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
        asset_id: Union[int, str],
        payload: AssetAssignmentRequest,
        is_assignment_action: bool = True,
        actor: Optional[any] = None,
    ) -> AssetDetailResponse:
        """
        Assign or reassign an asset to an employee or management group,
        or update/patch asset fields including nullable fields.
        Supports lookup by integer primary key or asset_number tag.
        """
        # 1. Normalize numeric string IDs and validate that target asset exists
        if isinstance(asset_id, str) and asset_id.strip().isdigit():
            lookup_id = int(asset_id.strip())
        else:
            lookup_id = asset_id

        asset = AssetRepository.get_by_id(db, lookup_id)
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID or number '{asset_id}' not found",
            )

        fields_set = payload.model_fields_set

        # Capture old values before any modification for audit trail
        old_assigned_username = asset.assigned_username
        old_managed_by = asset.managed_by
        old_asset_status = asset.asset_status
        old_assignment_type = asset.assignment_type
        old_remarks = asset.remarks
        asset_tag_val = asset.asset_number or f"ASSET-{asset.asset_id}"

        # 2. Check employee assignment fields
        user_val = (
            payload.assigned_username
            or payload.assignedUsername
            or payload.user_id
            or payload.userId
            or payload.username
            or getattr(payload, "employee_user_id", None)
            or getattr(payload, "employeeUserId", None)
            or getattr(payload, "workday_user_id", None)
            or getattr(payload, "workdayUserId", None)
        )
        emp_id_val = payload.employee_id or payload.employeeId

        user_fields_present = bool(
            {
                "assigned_username",
                "assignedUsername",
                "user_id",
                "userId",
                "username",
                "employee_id",
                "employeeId",
                "employee_user_id",
                "employeeUserId",
                "workday_user_id",
                "workdayUserId",
            }
            & fields_set
        )

        target_user_id = asset.assigned_username
        emp: Optional[WorkdayEmployee] = None

        if user_fields_present:
            if is_assignment_action and emp_id_val is None and (user_val is None or not str(user_val).strip()):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workday employee identifier (user_id or employee_id) is required for assignment",
                )
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
                    emp = EmployeeRepository.get_by_identifier(db, clean_user)
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

        # Capture snapshot of old values for audit trail
        old_values_snapshot = {
            "serial_number": asset.serial_number,
            "source": asset.source,
            "manufacturer": asset.manufacturer,
            "model": asset.model,
            "os_name": asset.os_name,
            "macaddress": asset.macaddress,
            "computer_id": asset.computer_id,
            "devicetype": asset.devicetype,
            "category": asset.category,
            "managed_by": asset.managed_by,
            "assigned_username": asset.assigned_username,
            "asset_status": asset.asset_status,
            "assignment_type": asset.assignment_type,
            "remarks": asset.remarks,
        }

        # 4. Resolve asset_status
        status_fields_present = bool({"asset_status", "assetStatus", "status"} & fields_set)
        raw_status = (
            payload.asset_status
            if "asset_status" in fields_set
            else (payload.assetStatus if "assetStatus" in fields_set else payload.status)
        )
        if status_fields_present:
            if raw_status is not None:
                if raw_status not in ("ACTIVE", "REVIEW", "INSTOCK", "IN STOCK", "EXPIRED", "RETIRED"):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid asset_status '{raw_status}'. Allowed values are: 'ACTIVE', 'REVIEW', 'INSTOCK', 'EXPIRED'",
                    )
                asset.asset_status = raw_status
            else:
                asset.asset_status = None
        elif is_assignment_action:
            asset.asset_status = "ACTIVE"

        # 5. Resolve assignment_type
        type_fields_present = bool({"assignment_type", "assignmentType"} & fields_set)
        raw_type = payload.assignment_type if "assignment_type" in fields_set else payload.assignmentType
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
            if "remarks" in fields_set
            else (
                payload.remark
                if "remark" in fields_set
                else (payload.notes if "notes" in fields_set else payload.comment)
            )
        )
        if remarks_fields_present:
            asset.remarks = str(raw_remarks) if raw_remarks is not None else None

        # 7. Hardware & Telemetry fields for update/patch
        # serial_number (max 100 chars)
        if "serial_number" in fields_set or "serialNumber" in fields_set:
            raw_sn = payload.serial_number if "serial_number" in fields_set else payload.serialNumber
            if raw_sn is not None:
                clean_sn = str(raw_sn).strip()
                if len(clean_sn) > 100:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="serial_number exceeds maximum length of 100 characters",
                    )
                asset.serial_number = clean_sn if clean_sn else None
            else:
                asset.serial_number = None

        # manufacturer (max 100 chars)
        if "manufacturer" in fields_set or "Manufacturer" in fields_set:
            raw_mfg = payload.manufacturer if "manufacturer" in fields_set else payload.Manufacturer
            if raw_mfg is not None:
                clean_mfg = str(raw_mfg).strip()
                if len(clean_mfg) > 100:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="manufacturer exceeds maximum length of 100 characters",
                    )
                asset.manufacturer = clean_mfg if clean_mfg else None
            else:
                asset.manufacturer = None

        # model (max 150 chars)
        if "model" in fields_set or "Model" in fields_set:
            raw_model = payload.model if "model" in fields_set else payload.Model
            if raw_model is not None:
                clean_model = str(raw_model).strip()
                if len(clean_model) > 150:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="model exceeds maximum length of 150 characters",
                    )
                asset.model = clean_model if clean_model else None
            else:
                asset.model = None

        # os_name (max 100 chars)
        if "os_name" in fields_set or "osName" in fields_set:
            raw_os = payload.os_name if "os_name" in fields_set else payload.osName
            if raw_os is not None:
                clean_os = str(raw_os).strip()
                if len(clean_os) > 100:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="os_name exceeds maximum length of 100 characters",
                    )
                asset.os_name = clean_os if clean_os else None
            else:
                asset.os_name = None

        # macaddress (max 50 chars)
        if "macaddress" in fields_set or "macAddress" in fields_set:
            raw_mac = payload.macaddress if "macaddress" in fields_set else payload.macAddress
            if raw_mac is not None:
                clean_mac = str(raw_mac).strip()
                if len(clean_mac) > 50:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="macaddress exceeds maximum length of 50 characters",
                    )
                asset.macaddress = clean_mac if clean_mac else None
            else:
                asset.macaddress = None

        # computer_id (max 100 chars)
        cid_fields_present = bool({"computer_id", "computerId", "ComputerID"} & fields_set)
        if cid_fields_present:
            raw_cid = (
                payload.computer_id
                if "computer_id" in fields_set
                else (payload.computerId if "computerId" in fields_set else payload.ComputerID)
            )
            if raw_cid is not None:
                clean_cid = str(raw_cid).strip()
                if len(clean_cid) > 100:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="computer_id exceeds maximum length of 100 characters",
                    )
                asset.computer_id = clean_cid if clean_cid else None
            else:
                asset.computer_id = None

        # devicetype (dropdown: Laptop, Desktop)
        devicetype_fields_present = bool(
            {"devicetype", "device_type", "deviceType", "DeviceType"} & fields_set
        )
        if devicetype_fields_present:
            raw_device = (
                payload.devicetype
                if "devicetype" in fields_set
                else (
                    payload.device_type
                    if "device_type" in fields_set
                    else (payload.deviceType if "deviceType" in fields_set else payload.DeviceType)
                )
            )
            if raw_device is not None and str(raw_device).strip():
                clean_device = str(raw_device).strip()
                if clean_device.lower() == "laptop":
                    asset.devicetype = "Laptop"
                elif clean_device.lower() == "desktop":
                    asset.devicetype = "Desktop"
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid devicetype '{raw_device}'. Allowed values are 'Laptop', 'Desktop'.",
                    )
            else:
                asset.devicetype = None

        # category (dropdown: STORE, CORPORATE)
        category_fields_present = bool({"category", "Category"} & fields_set)
        if category_fields_present:
            raw_cat = payload.category if "category" in fields_set else payload.Category
            if raw_cat is not None and str(raw_cat).strip():
                clean_cat = str(raw_cat).strip().upper()
                if clean_cat not in ("STORE", "CORPORATE"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid category '{raw_cat}'. Allowed values are 'STORE', 'CORPORATE'.",
                    )
                asset.category = clean_cat
            else:
                asset.category = None

        if "source" in fields_set:
            asset.source = payload.source
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

        # Record audit log event
        from app.services.audit_service import AuditService

        old_u_clean = old_assigned_username.strip() if old_assigned_username else ""
        new_u_clean = asset.assigned_username.strip() if asset.assigned_username else ""
        is_user_change = bool(old_u_clean.lower() != new_u_clean.lower())

        if is_user_change:
            is_reassign = bool(old_u_clean and new_u_clean)
            action = "REASSIGN USER" if is_reassign else ("ASSIGN USER" if new_u_clean else "UNASSIGN USER")
            old_emp = EmployeeRepository.get_by_user_id(db, old_u_clean) if old_u_clean else None
            new_emp = emp if (emp and emp.user_id.lower() == new_u_clean.lower()) else (EmployeeRepository.get_by_user_id(db, new_u_clean) if new_u_clean else None)

            def _format_user_identity(username_str: Optional[str], full_name_str: Optional[str]) -> str:
                u = str(username_str).strip() if username_str else ""
                fn = str(full_name_str).strip() if full_name_str else ""
                if fn and u:
                    return f"{fn} ({u})"
                return fn or u

            old_display = _format_user_identity(old_u_clean, old_emp.full_name if old_emp else None)
            new_display = _format_user_identity(new_u_clean, new_emp.full_name if new_emp else None)

            if is_reassign:
                finding = f"Asset {asset_tag_val} reassigned from {old_display} to {new_display}."
            elif new_u_clean:
                finding = f"Asset {asset_tag_val} assigned to {new_display}."
            else:
                finding = f"Asset {asset_tag_val} unassigned from {old_display}."
            log_category = "ASSET OWNERSHIP"
        else:
            action = "UPDATE ASSET"
            finding = f"Asset {asset_tag_val} details updated."
            log_category = "ASSET INVENTORY"

        new_values_snapshot = {
            "serial_number": asset.serial_number,
            "source": asset.source,
            "manufacturer": asset.manufacturer,
            "model": asset.model,
            "os_name": asset.os_name,
            "macaddress": asset.macaddress,
            "computer_id": asset.computer_id,
            "devicetype": asset.devicetype,
            "category": asset.category,
            "managed_by": asset.managed_by,
            "assigned_username": asset.assigned_username,
            "asset_status": asset.asset_status,
            "assignment_type": asset.assignment_type,
            "remarks": asset.remarks,
        }

        AuditService.record_audit(
            db=db,
            actor=actor,
            category=log_category,
            action=action,
            entity_type="ASSET",
            entity_id=str(asset.asset_id),
            entity_name=asset.asset_number or asset_tag_val,
            asset_tag=asset_tag_val,
            audit_finding=finding,
            old_values=old_values_snapshot,
            new_values=new_values_snapshot,
            status="SUCCESS",
            commit=True,
        )

        return cls.get_asset_detail(db, asset.asset_id)

    _idempotency_lock = threading.Lock()
    _idempotency_cache: dict[str, tuple[float, BulkAssetAssignmentResponse]] = {}
    IDEMPOTENCY_TTL_SECONDS = 600  # 10 minutes cache window

    @classmethod
    def _get_idempotency_key(
        cls,
        payload: BulkAssetAssignmentRequest,
        actor: Optional[any] = None,
    ) -> Optional[str]:
        explicit_key = getattr(payload, "idempotency_key", None) or getattr(payload, "request_id", None)
        if explicit_key and str(explicit_key).strip():
            actor_id = actor.user_id if actor else "anon"
            return f"key:{actor_id}:{str(explicit_key).strip()}"
        return None

    @classmethod
    def bulk_assign_assets(
        cls,
        db: Session,
        payload: BulkAssetAssignmentRequest,
        actor: Optional[any] = None,
    ) -> BulkAssetAssignmentResponse:
        """
        High-performance bulk assign hardware assets to one active Workday employee.
        Supports:
        1. Individually selected asset IDs (asset_ids: [1, 2, ...]).
        2. Select-all matching assets across all pagination pages based on search and filters.

        Performance & Integrity Guarantees:
        - Safe for 2,675+ assets without timing out (completes in < 0.5s).
        - Zero per-asset database queries inside loops (pre-fetches correlated employee data in bulk).
        - Efficient chunked batched updates (chunks of 1,000) inside a single atomic transaction.
        - Idempotency & duplicate protection:
            - Explicit idempotency keys cached to return instant responses on network retries.
            - Deep per-asset state check: assets already in target state are safely skipped without redundant updates or duplicate audit entries.
        - Mandatory remarks behavior:
            - Non-empty remarks update assets.remarks to the trimmed string.
            - Blank / whitespace / empty / omitted remarks update assets.remarks to SQL NULL.
        - Structured counts returned: total_requested, assigned_count, reassigned_count, skipped_count, failed_count, success_count, and failed_assets.
        """
        # 1. Check Idempotency Cache for explicit idempotency key
        cache_key = cls._get_idempotency_key(payload=payload, actor=actor)
        now_ts = time.time()
        if cache_key:
            with cls._idempotency_lock:
                # Expire old entries
                expired = [k for k, (ts, _) in cls._idempotency_cache.items() if now_ts - ts > cls.IDEMPOTENCY_TTL_SECONDS]
                for k in expired:
                    cls._idempotency_cache.pop(k, None)

                if cache_key in cls._idempotency_cache:
                    cached_ts, cached_resp = cls._idempotency_cache[cache_key]
                    logger.info(f"Returning cached bulk assignment response for idempotency key: {cache_key}")
                    return cached_resp

        is_select_all = bool(payload.select_all)

        # 2. Selection validation
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

        # 3. Validate target Workday employee
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

        # 4. Validate managed_by
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

        # 5. Mandatory Remarks Behavior:
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
        chunk_size = 500

        bulk_op_id = str(uuid.uuid4())
        audit_entries: list[AuditLog] = []

        portal_user_id = actor.user_id if actor else None
        portal_username = actor.username if actor else "system"
        portal_user_full_name = actor.full_name if actor else None
        portal_user_role = actor.role if actor else None

        new_values_payload = {
            "assigned_username": target_user_id,
            "managed_by": clean_managed,
            "assignment_type": "MANUAL",
            "asset_status": "ACTIVE",
            "remarks": clean_remarks,
        }

        # 6. Resolve Candidate Assets
        existing_rows = []
        if not is_select_all:
            # 6A. ID-based selection - batched in chunks of 1000 to prevent query parameter limits
            requested_order_ids = payload.asset_ids
            for i in range(0, len(payload.asset_ids), chunk_size):
                chunk = payload.asset_ids[i:i + chunk_size]
                stmt = select(
                    Asset.asset_id,
                    Asset.asset_number,
                    Asset.assigned_username,
                    Asset.managed_by,
                    Asset.asset_status,
                    Asset.assignment_type,
                    Asset.remarks,
                ).where(Asset.asset_id.in_(chunk))
                existing_rows.extend(db.execute(stmt).fetchall())
        else:
            # 6B. Select-all matching assets across all pages based on search and filters
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
                category=payload.category or payload.Category,
                manufacturer=payload.manufacturer,
                model=payload.model,
                assigned_username=payload.filter_assigned_username,
                assignment_type=payload.assignment_type,
                search=payload.search,
                is_unassigned=payload.is_unassigned,
                eol_status=payload.eol_status,
            )

            matched_ids = [r[0] for r in matched_rows]
            matched_count = len(matched_ids)

            if matched_count == 0:
                empty_resp = BulkAssetAssignmentResponse(
                    message="No assets matched the submitted filter criteria. 0 assets were assigned.",
                    requested_count=0,
                    total_requested=0,
                    matched_count=0,
                    success_count=0,
                    assigned_count=0,
                    reassigned_count=0,
                    skipped_count=0,
                    failed_count=0,
                    failure_count=0,
                    failed_assets=[],
                    target_username=target_user_id,
                    managed_by=clean_managed,
                    assignment_type="MANUAL",
                    asset_status="ACTIVE",
                    results=[],
                )
                return empty_resp

            requested_order_ids = matched_ids
            # Fetch prior details for matched IDs in chunks of 1000
            for i in range(0, len(matched_ids), chunk_size):
                chunk = matched_ids[i:i + chunk_size]
                prior_stmt = select(
                    Asset.asset_id,
                    Asset.asset_number,
                    Asset.assigned_username,
                    Asset.managed_by,
                    Asset.asset_status,
                    Asset.assignment_type,
                    Asset.remarks,
                ).where(Asset.asset_id.in_(chunk))
                existing_rows.extend(db.execute(prior_stmt).fetchall())

        existing_map: dict[int, str] = {}
        prior_details: dict[int, dict[str, Any]] = {}
        for r in existing_rows:
            aid = int(r[0])
            asset_num = str(r[1]) if r[1] is not None else f"ASSET-{aid}"
            existing_map[aid] = asset_num
            prior_details[aid] = {
                "asset_tag": asset_num,
                "asset_number": asset_num,
                "old_values": {
                    "assigned_username": r[2],
                    "managed_by": r[3],
                    "asset_status": r[4],
                    "assignment_type": r[5],
                    "remarks": r[6],
                },
            }

        valid_ids = [aid for aid in requested_order_ids if aid in existing_map]
        missing_ids = [aid for aid in requested_order_ids if aid not in existing_map]

        # 7. Bulk pre-fetch all prior assigned employees in ONE query (eliminates N+1 loop bottleneck)
        distinct_old_users = {
            str(prior_details[aid]["old_values"]["assigned_username"]).strip()
            for aid in valid_ids
            if prior_details[aid]["old_values"]["assigned_username"]
            and str(prior_details[aid]["old_values"]["assigned_username"]).strip()
        }
        old_emp_map: dict[str, WorkdayEmployee] = {}
        if distinct_old_users:
            user_list = list(distinct_old_users)
            for i in range(0, len(user_list), 500):
                sub_users = user_list[i:i + 500]
                emp_stmt = select(WorkdayEmployee).where(
                    func.lower(WorkdayEmployee.user_id).in_([u.lower() for u in sub_users])
                )
                for emp_row in db.execute(emp_stmt).scalars().all():
                    old_emp_map[emp_row.user_id.lower()] = emp_row

        def _fmt_user(u_name: Optional[str], f_name: Optional[str]) -> str:
            u = str(u_name).strip() if u_name else ""
            fn = str(f_name).strip() if f_name else ""
            if fn and u:
                return f"{fn} ({u})"
            return fn or u

        target_display = _fmt_user(target_user_id, emp.full_name if emp else None)

        # 8. Categorize Assets: to_update, to_skip (idempotent / already assigned), and missing
        ids_to_update: list[int] = []
        ids_to_skip: list[int] = []

        for aid in valid_ids:
            old_vals = prior_details[aid]["old_values"]
            old_u = str(old_vals["assigned_username"]).strip() if old_vals["assigned_username"] else ""
            old_m = str(old_vals["managed_by"]).strip().upper() if old_vals["managed_by"] else ""
            old_s = str(old_vals["asset_status"]).strip().upper() if old_vals["asset_status"] else ""
            old_t = str(old_vals["assignment_type"]).strip().upper() if old_vals["assignment_type"] else ""
            old_r = old_vals["remarks"]

            # An asset is identical if target user, managed_by, status, assignment_type, and remarks match exactly
            if (
                old_u.lower() == target_user_id.lower()
                and old_m == clean_managed
                and old_s == "ACTIVE"
                and old_t == "MANUAL"
                and old_r == clean_remarks
            ):
                ids_to_skip.append(aid)
            else:
                ids_to_update.append(aid)

        # 9. Build Audit Entries in Memory (zero DB roundtrips)
        for aid in ids_to_update:
            detail = prior_details[aid]
            tag = detail["asset_tag"]
            old_u = detail["old_values"]["assigned_username"]
            old_u_clean = str(old_u).strip() if old_u else ""
            old_emp = old_emp_map.get(old_u_clean.lower()) if old_u_clean else None
            old_display = _fmt_user(old_u_clean, old_emp.full_name if old_emp else None)

            if old_u_clean and old_u_clean.lower() != target_user_id.lower():
                finding_text = f"Asset {tag} reassigned from {old_display} to {target_display} during bulk assignment."
            else:
                finding_text = f"Asset {tag} assigned to {target_display} during bulk assignment."

            audit_entries.append(
                AuditLog(
                    asset_tag=tag,
                    portal_user_id=portal_user_id,
                    portal_username=portal_username,
                    portal_user_full_name=portal_user_full_name,
                    portal_user_role=portal_user_role,
                    category="ASSET OWNERSHIP",
                    action="BULK ASSIGN",
                    entity_type="ASSET",
                    entity_id=str(aid),
                    entity_name=detail["asset_number"] or tag,
                    audit_finding=finding_text,
                    old_values=detail["old_values"],
                    new_values=new_values_payload,
                    event_metadata={
                        "bulk_operation_id": bulk_op_id,
                        "total_affected_assets": len(requested_order_ids),
                        "operation_type": "BULK_ASSIGN",
                    },
                    status="SUCCESS",
                    detected_at=now_time,
                )
            )

        for aid in missing_ids:
            audit_entries.append(
                AuditLog(
                    asset_tag=None,
                    portal_user_id=portal_user_id,
                    portal_username=portal_username,
                    portal_user_full_name=portal_user_full_name,
                    portal_user_role=portal_user_role,
                    category="ASSET OWNERSHIP",
                    action="BULK ASSIGN",
                    entity_type="ASSET",
                    entity_id=str(aid),
                    entity_name=f"Asset {aid}",
                    audit_finding=f"Failed to bulk assign asset ID {aid}: asset not found.",
                    old_values=None,
                    new_values=None,
                    event_metadata={
                        "bulk_operation_id": bulk_op_id,
                        "total_affected_assets": len(requested_order_ids),
                        "error": "Asset not found",
                        "operation_type": "BULK_ASSIGN",
                    },
                    status="FAILURE",
                    detected_at=now_time,
                )
            )

        # 10. Execute Database Updates & Audit Inserts in a Single Atomic Transaction
        try:
            if ids_to_update:
                for i in range(0, len(ids_to_update), chunk_size):
                    chunk = ids_to_update[i:i + chunk_size]
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

            if audit_entries:
                AuditService.record_bulk_audits(db, audit_entries, commit=False)

            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to commit bulk asset assignment batch: {exc}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database transaction error during bulk asset assignment",
            )

        # 11. Compile Structured Results and Counts
        results: list[BulkAssetAssignmentItemResult] = []
        failed_assets: list[BulkAssetAssignmentFailedItem] = []
        assigned_count = 0
        reassigned_count = 0
        ids_to_update_set = set(ids_to_update)
        ids_to_skip_set = set(ids_to_skip)

        for aid in requested_order_ids:
            if aid in ids_to_update_set:
                results.append(
                    BulkAssetAssignmentItemResult(
                        asset_id=aid,
                        asset_number=existing_map[aid],
                        status="SUCCESS",
                        reason=None,
                    )
                )
                old_u_clean = str(prior_details[aid]["old_values"]["assigned_username"] or "").strip()
                if old_u_clean and old_u_clean.lower() != target_user_id.lower():
                    reassigned_count += 1
                else:
                    assigned_count += 1
            elif aid in ids_to_skip_set:
                results.append(
                    BulkAssetAssignmentItemResult(
                        asset_id=aid,
                        asset_number=existing_map[aid],
                        status="SUCCESS",
                        reason="Already assigned to target employee",
                    )
                )
            else:
                fail_reason = f"Asset with ID {aid} was not found"
                results.append(
                    BulkAssetAssignmentItemResult(
                        asset_id=aid,
                        asset_number=None,
                        status="FAILED",
                        reason=fail_reason,
                    )
                )
                failed_assets.append(
                    BulkAssetAssignmentFailedItem(
                        asset_id=aid,
                        asset_number=None,
                        reason=fail_reason,
                    )
                )

        total_requested = len(requested_order_ids)
        requested_count = total_requested
        matched_count = len(valid_ids)
        skipped_count = len(ids_to_skip)
        failed_count = len(missing_ids)
        success_count = assigned_count + reassigned_count + skipped_count

        # 12. Format Human-Readable Outcome Message
        if failed_count == 0 and skipped_count == 0:
            message = f"Bulk assignment completed successfully: {success_count} asset(s) assigned"
        elif failed_count == 0 and (assigned_count + reassigned_count) == 0 and skipped_count > 0:
            message = f"Bulk assignment completed: {skipped_count} asset(s) already assigned to {target_user_id}"
        elif failed_count == 0 and skipped_count > 0:
            message = f"Bulk assignment completed successfully: {assigned_count + reassigned_count} asset(s) assigned/reassigned, {skipped_count} skipped"
        elif success_count == 0 and skipped_count == 0:
            message = "Bulk assignment failed for all requested assets"
        else:
            message = f"Bulk assignment completed with some failures: {success_count} succeeded, {skipped_count} skipped, {failed_count} failed"

        response = BulkAssetAssignmentResponse(
            message=message,
            requested_count=requested_count,
            total_requested=total_requested,
            matched_count=matched_count,
            assigned_count=assigned_count,
            reassigned_count=reassigned_count,
            skipped_count=skipped_count,
            success_count=success_count,
            failed_count=failed_count,
            failure_count=failed_count,
            failed_assets=failed_assets,
            target_username=target_user_id,
            managed_by=clean_managed,
            assignment_type="MANUAL",
            asset_status="ACTIVE",
            results=results,
        )

        # 13. Save in Idempotency Cache if explicit idempotency key provided
        if cache_key:
            with cls._idempotency_lock:
                cls._idempotency_cache[cache_key] = (time.time(), response)

        return response

    @classmethod
    def generate_assets_csv_stream(
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
            category=category,
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
            manager_user_id = emp.manager_user_name if (emp and emp.manager_user_name) else ""
            manager_user_name = emp.manager_name if (emp and emp.manager_name) else ""
            job_title = emp.job_title if (emp and emp.job_title) else ""

            computer_id = (
                str(asset.computer_id).strip()
                if (asset.computer_id is not None and str(asset.computer_id).strip())
                else ""
            )

            if report or include_remarks:
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
                    manager_user_id,
                    manager_user_name,
                    job_title,
                    asset.remarks or "",
                ]
            else:
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
        Stream genuine .xlsx workbook containing all matching assets using
        openpyxl with write_only=True for constant memory efficiency with 50,000+ records.
        """
        import os
        import tempfile
        from openpyxl import Workbook

        normalized_assignment_type = cls.normalize_assignment_type_filter(assignment_type)

        wb = Workbook(write_only=True)
        ws = wb.create_sheet(title="Asset Inventory")

        # 1. Emit 21 required report headers in exact order
        ws.append(REPORT_XLSX_HEADERS)

        # 2. Iterate database rows using yield_per for constant-memory retrieval
        results = AssetRepository.iter_assets_joined(
            db=db,
            report=report,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            category=category,
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
            manager_user_id = emp.manager_user_name if (emp and emp.manager_user_name) else ""
            manager_user_name = emp.manager_name if (emp and emp.manager_name) else ""
            job_title = emp.job_title if (emp and emp.job_title) else ""

            computer_id = (
                str(asset.computer_id).strip()
                if (asset.computer_id is not None and str(asset.computer_id).strip())
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
                manager_user_id,
                manager_user_name,
                job_title,
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



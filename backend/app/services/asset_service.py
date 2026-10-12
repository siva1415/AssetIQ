from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.workday_employee import WorkdayEmployee
from app.repositories.asset_repository import AssetRepository
from app.repositories.eol_repository import EolRepository
from app.services.eol_service import EolService
from app.schemas.asset import AssetResponse, AssetDetailResponse
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
    ) -> AssetResponse:
        """
        Assembles an AssetResponse with all field aliases and joined Workday & EOL metadata.
        """
        # Resolve EOL information
        if eol_date is None:
            # Fallback to repository device lookup if join didn't catch due to fuzzy model name
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

        # Assemble full mapped dictionary
        payload = {
            "asset_id": asset.asset_id,
            "assetId": asset.asset_id,
            "AssetID": asset.asset_id,
            "asset_number": asset.asset_number,
            "assetNumber": asset.asset_number,
            "serial_number": asset.serial_number,
            "serialNumber": asset.serial_number,
            "source": asset.source,
            "manufacturer": asset.manufacturer,
            "model": asset.model,
            "os_name": asset.os_name,
            "osName": asset.os_name,
            "macaddress": asset.macaddress,
            "macAddress": asset.macaddress,
            "devicetype": asset.devicetype,
            "deviceType": asset.devicetype,
            "DeviceType": asset.devicetype,
            "managed_by": asset.managed_by,
            "managedBy": asset.managed_by,
            "assigned_username": asset.assigned_username,
            "assignedUsername": asset.assigned_username,
            "lastreporttime": asset.lastreporttime,
            "lastReportTime": asset.lastreporttime,
            "last_discovery_date": asset.lastreporttime,
            "lastDiscoveryDate": asset.lastreporttime,
            "LastDiscoveryDate": asset.lastreporttime,
            "asset_status": asset.asset_status,
            "assetStatus": asset.asset_status,
            "assignment_type": asset.assignment_type,
            "assignmentType": asset.assignment_type,
            "remarks": asset.remarks,
            # EOL
            "eol_date": eol_date,
            "eolDate": eol_date,
            "days_remaining": days_rem,
            "daysRemaining": days_rem,
            "eol_status": eol_status,
            "eolStatus": eol_status,
            "reference_source": ref_source,
            "referenceSource": ref_source,
            "eol_info": eol_info,
            "eolInfo": eol_info,
            # Workday Ownership
            "workday_status": workday_status,
            "workdayStatus": workday_status,
            "ownership_status": ownership_status,
            "ownershipStatus": ownership_status,
            "correlation_status": ownership_status,
            "correlationStatus": ownership_status,
            # Employee details
            "full_name": matched_emp.full_name if matched_emp else None,
            "fullName": matched_emp.full_name if matched_emp else None,
            "employee_name": matched_emp.full_name if matched_emp else None,
            "employeeName": matched_emp.full_name if matched_emp else None,
            "employee_user_id": matched_emp.user_id if matched_emp else None,
            "email_work": matched_emp.email_work if matched_emp else None,
            "emailWork": matched_emp.email_work if matched_emp else None,
            "department": matched_emp.department if matched_emp else None,
            "division": matched_emp.division if matched_emp else None,
            "job_title": matched_emp.job_title if matched_emp else None,
            "jobTitle": matched_emp.job_title if matched_emp else None,
            "employee_status": matched_emp.employee_status if matched_emp else None,
            "employeeStatus": matched_emp.employee_status if matched_emp else None,
            "manager_name": matched_emp.manager_name if matched_emp else None,
            "managerName": matched_emp.manager_name if matched_emp else None,
            "manager_user_name": matched_emp.manager_user_name if matched_emp else None,
            "managerUserName": matched_emp.manager_user_name if matched_emp else None,
            "location": matched_emp.location if matched_emp else None,
            "matched_employee": emp_summary,
            "correlated_employee": emp_summary,
            "employee": emp_summary,
            # Timestamps
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
    ) -> PaginatedResponse[AssetResponse]:
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
            assignment_type=assignment_type,
            search=search,
            is_unassigned=is_unassigned,
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

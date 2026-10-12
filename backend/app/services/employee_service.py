from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.workday_employee import WorkdayEmployee
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.asset_repository import AssetRepository
from app.schemas.employee import EmployeeResponse, EmployeeDetailResponse, AssignedAssetSummary
from app.schemas.common import PaginatedResponse


class EmployeeService:
    """
    Business logic for Workday employee directory and asset correlation.
    """

    @classmethod
    def get_employee_detail(cls, db: Session, employee_id: int) -> EmployeeDetailResponse:
        employee = EmployeeRepository.get_by_id(db, employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found",
            )

        # Retrieve all correlated assets assigned to this employee's user_id
        assigned_assets = AssetRepository.get_assets_by_assigned_username(db, employee.user_id)
        asset_summaries = [
            AssignedAssetSummary.model_validate(asset) for asset in assigned_assets
        ]

        return EmployeeDetailResponse(
            employee_id=employee.employee_id,
            user_id=employee.user_id,
            full_name=employee.full_name,
            email_work=employee.email_work,
            email_home=employee.email_home,
            department=employee.department,
            division=employee.division,
            job_title=employee.job_title,
            employee_status=employee.employee_status,
            manager_user_name=employee.manager_user_name,
            manager_name=employee.manager_name,
            location=employee.location,
            hire_date=employee.hire_date,
            created_at=employee.created_at,
            updated_at=employee.updated_at,
            last_synced_at=employee.last_synced_at,
            assigned_assets=asset_summaries,
            assigned_assets_count=len(asset_summaries),
        )

    @classmethod
    def list_employees(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        user_id: Optional[str] = None,
        name: Optional[str] = None,
        department: Optional[str] = None,
        division: Optional[str] = None,
        employee_status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[EmployeeResponse]:
        skip = (page - 1) * page_size
        employees, total_count = EmployeeRepository.list_employees(
            db=db,
            skip=skip,
            limit=page_size,
            user_id=user_id,
            name=name,
            department=department,
            division=division,
            employee_status=employee_status,
            search=search,
        )

        items = [EmployeeResponse.model_validate(emp) for emp in employees]
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0

        return PaginatedResponse(
            items=items,
            total_items=total_count,
            total_pages=total_pages,
            page=page,
            page_size=page_size,
        )

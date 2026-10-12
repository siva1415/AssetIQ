from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import PaginationParams, get_database
from app.schemas.employee import EmployeeResponse, EmployeeDetailResponse
from app.schemas.common import PaginatedResponse
from app.services.employee_service import EmployeeService

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get(
    "",
    response_model=PaginatedResponse[EmployeeResponse],
    summary="Paginated Workday Employees Directory",
)
def list_employees(
    pagination: PaginationParams = Depends(),
    user_id: Optional[str] = Query(None, description="Exact or normalized user ID"),
    name: Optional[str] = Query(None, description="Employee full name partial match"),
    department: Optional[str] = Query(None, description="Department filter"),
    division: Optional[str] = Query(None, description="Division filter"),
    employee_status: Optional[str] = Query(None, description="Employment status (e.g. Active)"),
    search: Optional[str] = Query(None, description="Global text search in name, user_id, email, department"),
    db: Session = Depends(get_database),
):
    """
    Search and retrieve Workday employees with pagination.
    """
    return EmployeeService.list_employees(
        db=db,
        page=pagination.page,
        page_size=pagination.page_size,
        user_id=user_id,
        name=name,
        department=department,
        division=division,
        employee_status=employee_status,
        search=search,
    )


@router.get(
    "/{employee_id}",
    response_model=EmployeeDetailResponse,
    summary="Employee Profile with Correlated Assigned Assets",
)
def get_employee_by_id(
    employee_id: int,
    db: Session = Depends(get_database),
):
    """
    Retrieve comprehensive Workday employee data together with all hardware assets
    currently correlated to their user login.
    """
    return EmployeeService.get_employee_detail(db=db, employee_id=employee_id)

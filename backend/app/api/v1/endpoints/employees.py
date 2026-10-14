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
@router.get(
    "/",
    response_model=PaginatedResponse[EmployeeResponse],
    include_in_schema=False,
)
def list_employees(
    pagination: PaginationParams = Depends(),
    user_id: Optional[str] = Query(None, description="Exact or normalized user ID"),
    userId: Optional[str] = Query(None, include_in_schema=False),
    username: Optional[str] = Query(None, include_in_schema=False),
    name: Optional[str] = Query(None, description="Employee full name partial match"),
    full_name: Optional[str] = Query(None, include_in_schema=False),
    fullName: Optional[str] = Query(None, include_in_schema=False),
    email: Optional[str] = Query(None, include_in_schema=False),
    email_work: Optional[str] = Query(None, include_in_schema=False),
    emailWork: Optional[str] = Query(None, include_in_schema=False),
    department: Optional[str] = Query(None, description="Department filter"),
    division: Optional[str] = Query(None, description="Division filter"),
    employee_status: Optional[str] = Query(None, description="Employment status (e.g. Active)"),
    status: Optional[str] = Query(None, include_in_schema=False),
    employeeStatus: Optional[str] = Query(None, include_in_schema=False),
    search: Optional[str] = Query(None, description="Global text search in name, user_id, email, department"),
    q: Optional[str] = Query(None, include_in_schema=False),
    query: Optional[str] = Query(None, include_in_schema=False),
    keyword: Optional[str] = Query(None, include_in_schema=False),
    term: Optional[str] = Query(None, include_in_schema=False),
    filter: Optional[str] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Search and retrieve Workday employees with pagination.
    """
    eff_search = search or q or query or keyword or term or filter
    eff_user_id = user_id or userId or username
    eff_name = name or full_name or fullName
    eff_email = email or email_work or emailWork
    eff_status = employee_status or status or employeeStatus

    return EmployeeService.list_employees(
        db=db,
        page=pagination.page,
        page_size=pagination.page_size,
        user_id=eff_user_id,
        name=eff_name,
        email=eff_email,
        department=department,
        division=division,
        employee_status=eff_status,
        search=eff_search,
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

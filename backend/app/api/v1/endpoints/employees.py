from typing import Optional, Union
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from app.api.deps import _parse_int_param, get_database
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
    page: Optional[Union[int, str]] = Query(1, description="Page number (1-indexed, default 1)"),
    page_size: Optional[Union[int, str]] = Query(
        10,
        description="Items per page (default 10, max 100)",
    ),
    pageSize: Optional[Union[int, str]] = Query(None, include_in_schema=False),
    limit: Optional[Union[int, str]] = Query(None, include_in_schema=False),
    offset: Optional[Union[int, str]] = Query(None, include_in_schema=False),
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
    active_only: Optional[bool] = Query(None, description="Filter only active employees (default true)"),
    activeOnly: Optional[bool] = Query(None, include_in_schema=False),
    search: Optional[str] = Query(None, description="Global text search in name, user_id, email, department"),
    q: Optional[str] = Query(None, include_in_schema=False),
    query: Optional[str] = Query(None, include_in_schema=False),
    keyword: Optional[str] = Query(None, include_in_schema=False),
    term: Optional[str] = Query(None, include_in_schema=False),
    filter: Optional[str] = Query(None, include_in_schema=False),
    sort_by: Optional[str] = Query(None, description="Sort field (e.g. full_name, user_id, employee_id)"),
    sort_order: Optional[str] = Query("asc", description="Sort order ('asc' or 'desc')"),
    sortBy: Optional[str] = Query(None, include_in_schema=False),
    sortOrder: Optional[str] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Search and retrieve Workday employees with database-level pagination, active status filtering,
    and multi-field search across name, user ID, email, and department.
    """
    eff_search = search or q or query or keyword or term or filter
    eff_user_id = user_id or userId or username
    eff_name = name or full_name or fullName
    eff_email = email or email_work or emailWork
    eff_status = employee_status or status or employeeStatus
    eff_active_only = active_only if active_only is not None else activeOnly
    eff_sort_by = sort_by or sortBy
    eff_sort_order = sort_order or sortOrder or "asc"

    # Defensive parsing of pagination parameters
    raw_page = _parse_int_param(page, 1)
    raw_offset = _parse_int_param(offset, None) if offset is not None else None

    # Resolve page_size: defaults to 10, max 100
    raw_size = None
    if page_size is not None:
        raw_size = _parse_int_param(page_size, 10)
    elif pageSize is not None:
        raw_size = _parse_int_param(pageSize, 10)
    elif limit is not None:
        raw_size = _parse_int_param(limit, 10)
    else:
        raw_size = 10

    if raw_size <= 0:
        raw_size = 10

    # Enforce maximum page size of 100
    if raw_size > 100:
        raw_size = 100

    # Handle offset to page conversion
    if raw_offset is not None and (page is None or raw_page == 1):
        raw_page = (raw_offset // raw_size) + 1 if raw_size > 0 else 1

    if raw_page < 1:
        raw_page = 1

    return EmployeeService.list_employees(
        db=db,
        page=raw_page,
        page_size=raw_size,
        user_id=eff_user_id,
        name=eff_name,
        email=eff_email,
        department=department,
        division=division,
        employee_status=eff_status,
        active_only=eff_active_only,
        search=eff_search,
        sort_by=eff_sort_by,
        sort_order=eff_sort_order,
    )



@router.get(
    "/{employee_id}",
    response_model=EmployeeDetailResponse,
    summary="Employee Profile with Correlated Assigned Assets",
)
def get_employee_by_id(
    employee_id: str = Path(
        ...,
        description="Numeric employee ID or string employee identifier (e.g. user_id)",
    ),
    db: Session = Depends(get_database),
):
    """
    Retrieve comprehensive Workday employee data together with all hardware assets
    currently correlated to their user login.
    Supports lookup by numeric employee_id (primary key) or string employee identifier (user_id).
    """
    return EmployeeService.get_employee_detail(db=db, identifier=employee_id)

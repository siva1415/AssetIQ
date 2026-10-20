from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session

from app.api.deps import PaginationParams, get_database
from app.schemas.employee import EmployeeResponse, EmployeeDetailResponse
from app.schemas.common import PaginatedResponse
from app.services.employee_service import (
    EmployeeService,
    ConsoleUserResponse,
    CreateUserRequest,
    UpdateUserRequest,
    SetOtpRequest,
    FirstLoginDecisionRequest,
    SessionListResponse,
    TerminateSessionRequest,
)

router = APIRouter(tags=["Employees & Console User Management"])


# ============================================================================
# 1. Workday Employee Directory Endpoints
# ============================================================================

@router.get(
    "/employees",
    response_model=PaginatedResponse[EmployeeResponse],
    summary="Paginated Workday Employees Directory",
)
@router.get(
    "/employees/",
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


def _read_field(obj, key, default=None):
    """Read a field from either a dict or an object (service may return either)."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


@router.get(
    "/employees/all",
    response_model=PaginatedResponse[EmployeeResponse],
    summary="Retrieve ALL Workday employee records (no pagination) for reports/exports",
)
@router.get(
    "/employees/all/",
    response_model=PaginatedResponse[EmployeeResponse],
    include_in_schema=False,
)
def list_all_employees(
    department: Optional[str] = Query(None, description="Department filter"),
    division: Optional[str] = Query(None, description="Division filter"),
    employee_status: Optional[str] = Query(None, description="Employment status (e.g. Active)"),
    status: Optional[str] = Query(None, include_in_schema=False),
    employeeStatus: Optional[str] = Query(None, include_in_schema=False),
    search: Optional[str] = Query(None, description="Global text search in name, user_id, email, department"),
    q: Optional[str] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Returns every employee row matching the optional filters in a single response.
    Walks the paginated EmployeeService in chunks so the existing filtering and
    response mapping are reused.
    Must be declared before '/employees/{employee_id}' so 'all' is not parsed as an id.
    """
    eff_search = search or q
    eff_status = employee_status or status or employeeStatus

    chunk_size = 100  # stay within any page_size cap enforced by the service/deps
    page = 1
    all_items: list = []
    total = 0
    while True:
        result = EmployeeService.list_employees(
            db=db,
            page=page,
            page_size=chunk_size,
            user_id=None,
            name=None,
            email=None,
            department=department,
            division=division,
            employee_status=eff_status,
            search=eff_search,
        )
        items = list(_read_field(result, "items", []) or [])
        total = int(_read_field(result, "total", 0) or 0)
        total_pages = int(_read_field(result, "total_pages", 1) or 1)
        all_items.extend(items)
        if not items or page >= total_pages or len(all_items) >= total:
            break
        page += 1

    count = len(all_items)
    return {
        "items": all_items,
        "total": count,
        "page": 1,
        "page_size": count,
        "total_pages": 1,
    }


@router.get(
    "/employees/{employee_id}",
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


# ============================================================================
# 2. Console User Management Endpoints (/api/users)
# ============================================================================

@router.get(
    "/users",
    response_model=List[ConsoleUserResponse],
    summary="List all console users with real-time online status",
)
@router.get(
    "/employees/users",
    response_model=List[ConsoleUserResponse],
    include_in_schema=False,
)
def get_console_users(
    search: Optional[str] = Query(None, description="Search users by name, username, email, or role"),
    q: Optional[str] = Query(None, include_in_schema=False),
    db: Session = Depends(get_database),
):
    """
    Returns registered console accounts along with real-time active status,
    password policy flags, and role assignments.
    """
    term = search or q
    return EmployeeService.list_console_users(db=db, search=term)


@router.post(
    "/auth/register",
    response_model=ConsoleUserResponse,
    summary="Register a new console user account",
)
@router.post(
    "/users",
    response_model=ConsoleUserResponse,
    summary="Create a new console user account",
)
@router.post(
    "/employees/users",
    response_model=ConsoleUserResponse,
    include_in_schema=False,
)
def create_console_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_database),
):
    """
    Creates a new console administrator or viewer account.
    Supports setting One-Time Password (OTP) policy.
    """
    return EmployeeService.create_console_user(db=db, payload=payload)


@router.put(
    "/users/{username}",
    response_model=ConsoleUserResponse,
    summary="Update console user details or reset password",
)
@router.put(
    "/employees/users/{username}",
    response_model=ConsoleUserResponse,
    include_in_schema=False,
)
def update_console_user(
    username: str = Path(..., description="Target username"),
    payload: UpdateUserRequest = ...,
    db: Session = Depends(get_database),
):
    """
    Updates full name, email, role clearance, or issues a password update / OTP flag.
    """
    return EmployeeService.update_console_user(db=db, username=username, payload=payload)


@router.delete(
    "/users/{username}",
    summary="Permanently delete a console user account",
)
@router.delete(
    "/employees/users/{username}",
    include_in_schema=False,
)
def delete_console_user(
    username: str = Path(..., description="Target username to delete"),
    db: Session = Depends(get_database),
):
    """
    Deletes a user account from the system.
    Guarantees root protection: @superadmin cannot be deleted.
    """
    return EmployeeService.delete_console_user(db=db, username=username)


# ============================================================================
# 3. OTP & Security Policy Governance Endpoints (/api/auth)
# ============================================================================

@router.post(
    "/auth/set-otp",
    summary="Issue a temporary One-Time Password (OTP)",
)
@router.post(
    "/users/set-otp",
    include_in_schema=False,
)
def set_one_time_password(
    payload: SetOtpRequest,
    db: Session = Depends(get_database),
):
    """
    Issues a temporary One-Time Password for the target username and
    forces a mandatory password reset upon their next login.
    """
    return EmployeeService.issue_one_time_password(db=db, payload=payload)


@router.post(
    "/auth/first-login-decision",
    summary="Process first-login permanent password decision",
)
@router.post(
    "/users/first-login-decision",
    include_in_schema=False,
)
def process_first_login_decision(
    payload: FirstLoginDecisionRequest,
    db: Session = Depends(get_database),
):
    """
    Allows a user logging in under an OTP to set a permanent password
    and complete security onboarding.
    """
    return EmployeeService.process_first_login_decision(db=db, payload=payload)


# ============================================================================
# 4. Live Active Sessions Telemetry Endpoints (/api/auth/sessions)
# ============================================================================

@router.get(
    "/auth/sessions",
    response_model=SessionListResponse,
    summary="Real-time active console sessions (Polled every 5s)",
)
@router.get(
    "/sessions",
    response_model=SessionListResponse,
    include_in_schema=False,
)
def get_active_sessions(
    db: Session = Depends(get_database),
):
    """
    Returns real-time logged-in user telemetry (IP address, user-agent, login time,
    and last active timestamp) for live dashboard tracking.
    """
    return EmployeeService.list_active_sessions(db=db)


@router.post(
    "/auth/sessions/terminate",
    summary="Terminate an active user session",
)
@router.post(
    "/sessions/terminate",
    include_in_schema=False,
)
def terminate_session(
    payload: TerminateSessionRequest,
    db: Session = Depends(get_database),
):
    """
    Terminates an active session by session ID or username.
    """
    return EmployeeService.terminate_session(db=db, payload=payload)
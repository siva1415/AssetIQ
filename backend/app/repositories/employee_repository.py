from typing import List, Optional, Tuple
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session
from app.models.workday_employee import WorkdayEmployee


class EmployeeRepository:
    """
    Data access repository for the `workday_employees` table.
    """

    @staticmethod
    def get_by_id(db: Session, employee_id: int) -> Optional[WorkdayEmployee]:
        stmt = select(WorkdayEmployee).where(WorkdayEmployee.employee_id == employee_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_user_id(db: Session, user_id: str) -> Optional[WorkdayEmployee]:
        clean_user_id = user_id.strip().lower()
        stmt = select(WorkdayEmployee).where(
            func.lower(func.trim(WorkdayEmployee.user_id)) == clean_user_id
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def list_employees(
        db: Session,
        skip: int = 0,
        limit: int = 10,
        user_id: Optional[str] = None,
        name: Optional[str] = None,
        email: Optional[str] = None,
        department: Optional[str] = None,
        division: Optional[str] = None,
        employee_status: Optional[str] = None,
        active_only: Optional[bool] = None,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = "asc",
    ) -> Tuple[List[WorkdayEmployee], int]:
        """
        List employees with database-level pagination, multi-field filtering, and deterministic ordering.
        Supports active employee filtering (UPPER(TRIM(employee_status)) = 'ACTIVE') and global search.
        """
        stmt: Select = select(WorkdayEmployee)

        # Status filtering:
        # Default behavior (or when active_only=True): retrieve only active employees.
        # If employee_status is explicitly given:
        #   - 'ALL' or 'all': skip status filtering (all statuses included)
        #   - other status string: match case-insensitively
        # If active_only is explicitly False and no employee_status provided: include all statuses.
        if employee_status and employee_status.strip():
            clean_status = employee_status.strip().upper()
            if clean_status != "ALL":
                stmt = stmt.where(
                    func.upper(func.trim(WorkdayEmployee.employee_status)) == clean_status
                )
        elif active_only is False:
            pass  # Explicitly disabled active-only filter
        else:
            # Default: active employees only
            stmt = stmt.where(
                func.upper(func.trim(WorkdayEmployee.employee_status)) == "ACTIVE"
            )

        if user_id and user_id.strip():
            clean_uid = user_id.strip().lower()
            stmt = stmt.where(
                or_(
                    func.lower(func.trim(WorkdayEmployee.user_id)) == clean_uid,
                    func.lower(WorkdayEmployee.user_id).like(f"%{clean_uid}%"),
                )
            )
        if name and name.strip():
            stmt = stmt.where(
                func.lower(WorkdayEmployee.full_name).like(f"%{name.strip().lower()}%")
            )
        if email and email.strip():
            stmt = stmt.where(
                func.lower(WorkdayEmployee.email_work).like(f"%{email.strip().lower()}%")
            )
        if department and department.strip():
            stmt = stmt.where(
                func.lower(WorkdayEmployee.department).like(f"%{department.strip().lower()}%")
            )
        if division and division.strip():
            stmt = stmt.where(
                func.lower(WorkdayEmployee.division).like(f"%{division.strip().lower()}%")
            )

        if search and search.strip():
            search_pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(func.coalesce(WorkdayEmployee.user_id, "")).like(search_pattern),
                    func.lower(func.coalesce(WorkdayEmployee.full_name, "")).like(search_pattern),
                    func.lower(func.coalesce(WorkdayEmployee.email_work, "")).like(search_pattern),
                    func.lower(func.coalesce(WorkdayEmployee.department, "")).like(search_pattern),
                    func.lower(func.coalesce(WorkdayEmployee.division, "")).like(search_pattern),
                    func.lower(func.coalesce(WorkdayEmployee.job_title, "")).like(search_pattern),
                )
            )

        # Count total records matching the exact filter conditions
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total_count = db.execute(count_stmt).scalar() or 0

        # Deterministic ordering (default: full_name ASC, user_id ASC)
        order_clauses = []
        if sort_by and sort_by.strip():
            col_name = sort_by.strip().lower()
            col = getattr(WorkdayEmployee, col_name, None)
            if col is not None:
                is_desc = (sort_order or "").strip().lower() == "desc"
                order_clauses.append(col.desc() if is_desc else col.asc())

        if not order_clauses:
            order_clauses = [
                WorkdayEmployee.full_name.asc(),
                WorkdayEmployee.user_id.asc(),
            ]
        else:
            # Ensure deterministic tie-breaker
            order_clauses.append(WorkdayEmployee.user_id.asc())

        # Paginated items directly in PostgreSQL with LIMIT and OFFSET
        paginated_stmt = stmt.order_by(*order_clauses).offset(skip).limit(limit)
        items = list(db.execute(paginated_stmt).scalars().all())

        return items, total_count


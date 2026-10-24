from typing import List, Optional, Tuple, Union
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
    def get_executive_committee_lookup(db: Session) -> dict[str, dict[str, str]]:
        """
        Builds a reusable lookup of executives in 'Executive Committee' department whose job_title
        starts with 'EVP -' or 'President -'.
        Stores their user_id and full_name.
        Caches on db.info to prevent repeated queries during a request or session.
        """
        if hasattr(db, "info") and "executive_committee_lookup" in db.info:
            return db.info["executive_committee_lookup"]

        stmt = select(
            WorkdayEmployee.user_id,
            WorkdayEmployee.full_name,
            WorkdayEmployee.job_title,
        ).where(
            func.lower(func.trim(WorkdayEmployee.department)) == "executive committee",
            WorkdayEmployee.user_id.is_not(None),
        )
        rows = db.execute(stmt).all()
        lookup: dict[str, dict[str, Any]] = {}
        for uid, fn, jt in rows:
            clean_jt = (jt or "").strip()
            # Match job_title starting with 'EVP -' or 'President -' (case-insensitive, trimmed)
            if clean_jt.lower().startswith("evp -") or clean_jt.lower().startswith("president -"):
                clean_uid = str(uid).strip()
                clean_fn = str(fn).strip() if fn else clean_uid
                if clean_uid:
                    lookup[clean_uid.lower()] = {
                        "user_id": clean_uid,
                        "full_name": clean_fn,
                        "job_title": clean_jt if clean_jt else None,
                    }

        if hasattr(db, "info"):
            db.info["executive_committee_lookup"] = lookup
        return lookup

    @staticmethod
    def get_by_identifier(db: Session, identifier: Union[int, str]) -> Optional[WorkdayEmployee]:
        """
        Look up an employee by numeric employee_id (primary key) or string identifier (user_id).
        Uses parameterized queries.
        - If identifier is numeric (e.g., 1582, "1582"), queries first by employee_id PK.
          If not found by PK, falls back to checking user_id (in case user_id is digits).
        - If identifier is string (e.g., "SYNTHUSER01582", "MOCKEMP1338"), queries by user_id
          case-insensitively with trimming.
        """
        if identifier is None:
            return None

        str_val = str(identifier).strip()
        if not str_val:
            return None

        # Check if numeric
        if isinstance(identifier, int) or str_val.isdigit():
            try:
                num_id = int(str_val)
                stmt = select(WorkdayEmployee).where(WorkdayEmployee.employee_id == num_id)
                emp = db.execute(stmt).scalar_one_or_none()
                if emp is not None:
                    return emp
            except (ValueError, OverflowError):
                pass

        # String lookup by user_id (case-insensitive, trimmed)
        clean_user_id = str_val.lower()
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


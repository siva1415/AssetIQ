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
        limit: int = 25,
        user_id: Optional[str] = None,
        name: Optional[str] = None,
        email: Optional[str] = None,
        department: Optional[str] = None,
        division: Optional[str] = None,
        employee_status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[WorkdayEmployee], int]:
        """
        List employees with pagination and multi-field filtering.
        """
        stmt: Select = select(WorkdayEmployee)

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
                func.lower(WorkdayEmployee.department) == department.strip().lower()
            )
        if division and division.strip():
            stmt = stmt.where(
                func.lower(WorkdayEmployee.division) == division.strip().lower()
            )
        if employee_status and employee_status.strip():
            stmt = stmt.where(
                func.lower(WorkdayEmployee.employee_status) == employee_status.strip().lower()
            )

        if search and search.strip():
            search_pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(WorkdayEmployee.user_id).like(search_pattern),
                    func.lower(WorkdayEmployee.full_name).like(search_pattern),
                    func.lower(WorkdayEmployee.email_work).like(search_pattern),
                    func.lower(WorkdayEmployee.department).like(search_pattern),
                    func.lower(WorkdayEmployee.division).like(search_pattern),
                    func.lower(WorkdayEmployee.job_title).like(search_pattern),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = db.execute(count_stmt).scalar() or 0

        # Paginated items ordered by employee_id
        paginated_stmt = stmt.order_by(WorkdayEmployee.employee_id.asc()).offset(skip).limit(limit)
        items = list(db.execute(paginated_stmt).scalars().all())

        return items, total_count


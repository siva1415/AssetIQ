from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.models.admin_user import AdminUser
from app.models.workday_employee import WorkdayEmployee


class AdminUserRepository:
    """
    Data access repository for `admin_users` joined to `workday_employees`.
    """

    @staticmethod
    def list_admin_users(db: Session) -> List[Tuple[AdminUser, Optional[WorkdayEmployee]]]:
        """
        List all admin users joined with their corresponding Workday employee record.
        """
        stmt = (
            select(AdminUser, WorkdayEmployee)
            .outerjoin(
                WorkdayEmployee,
                func.lower(func.trim(AdminUser.admin_user_id)) == func.lower(func.trim(WorkdayEmployee.user_id)),
            )
            .order_by(AdminUser.admin_user_id.asc())
        )
        return list(db.execute(stmt).all())

    @staticmethod
    def list_available_users(
        db: Session,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        user_id: Optional[str] = None,
        full_name: Optional[str] = None,
        email: Optional[str] = None,
    ) -> Tuple[List[WorkdayEmployee], int]:
        """
        Retrieves employees from workday_employees who are not in admin_users,
        supporting search (user_id, full_name, email_work) and pagination.
        """
        admin_subq = select(func.lower(func.trim(AdminUser.admin_user_id)))

        base_query = select(WorkdayEmployee).where(
            func.lower(func.trim(WorkdayEmployee.user_id)).not_in(admin_subq)
        )

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            base_query = base_query.where(
                or_(
                    func.lower(WorkdayEmployee.user_id).like(term),
                    func.lower(WorkdayEmployee.full_name).like(term),
                    func.lower(WorkdayEmployee.email_work).like(term),
                )
            )

        if user_id and user_id.strip():
            base_query = base_query.where(
                func.lower(WorkdayEmployee.user_id).like(f"%{user_id.strip().lower()}%")
            )
        if full_name and full_name.strip():
            base_query = base_query.where(
                func.lower(WorkdayEmployee.full_name).like(f"%{full_name.strip().lower()}%")
            )
        if email and email.strip():
            base_query = base_query.where(
                func.lower(WorkdayEmployee.email_work).like(f"%{email.strip().lower()}%")
            )

        count_stmt = select(func.count()).select_from(base_query.order_by(None).subquery())
        total = db.execute(count_stmt).scalar() or 0

        paginated_stmt = (
            base_query
            .order_by(WorkdayEmployee.full_name.asc(), WorkdayEmployee.user_id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(db.execute(paginated_stmt).scalars().all())
        return items, total

    @staticmethod
    def get_by_user_id(db: Session, admin_user_id: str) -> Optional[AdminUser]:
        clean_id = admin_user_id.strip().lower()
        stmt = select(AdminUser).where(
            func.lower(func.trim(AdminUser.admin_user_id)) == clean_id
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def add_admin_user(db: Session, admin_user_id: str) -> AdminUser:
        """
        Adds an authorized admin user, safely handling duplicates without raising constraint errors.
        """
        clean_id = admin_user_id.strip()
        existing = AdminUserRepository.get_by_user_id(db, clean_id)
        if existing:
            return existing

        admin = AdminUser(
            admin_user_id=clean_id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        return admin

    @staticmethod
    def delete_admin_user(db: Session, admin_user_id: str) -> bool:
        """
        Deletes an authorized admin user.
        """
        admin = AdminUserRepository.get_by_user_id(db, admin_user_id)
        if not admin:
            return False

        db.delete(admin)
        db.commit()
        return True

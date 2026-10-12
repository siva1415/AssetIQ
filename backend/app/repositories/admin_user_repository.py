from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select
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

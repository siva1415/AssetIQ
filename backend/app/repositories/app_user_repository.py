from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.models.app_user import AppUser


class AppUserRepository:
    """
    Data access layer for AppUser operations on the `app_users` table.
    """

    @staticmethod
    def get_by_id(db: Session, user_id: int) -> Optional[AppUser]:
        stmt = select(AppUser).where(AppUser.user_id == user_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_username(db: Session, username: str) -> Optional[AppUser]:
        if not username:
            return None
        clean = username.strip().lower()
        stmt = select(AppUser).where(func.lower(func.trim(AppUser.username)) == clean)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[AppUser]:
        if not email:
            return None
        clean = email.strip().lower()
        stmt = select(AppUser).where(func.lower(func.trim(AppUser.email)) == clean)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def count_active_superadmins(db: Session) -> int:
        stmt = select(func.count(AppUser.user_id)).where(
            AppUser.role == "SUPERADMIN",
            AppUser.status == "ACTIVE"
        )
        return int(db.execute(stmt).scalar() or 0)

    @classmethod
    def list_users(
        cls,
        db: Session,
        skip: int = 0,
        limit: int = 25,
        search: Optional[str] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Tuple[List[AppUser], int]:
        """
        Retrieves paginated app_users matching dynamic search and filters.
        """
        stmt = select(AppUser)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(AppUser.username).like(term),
                    func.lower(AppUser.full_name).like(term),
                    func.lower(AppUser.email).like(term),
                )
            )

        if role and role.strip():
            stmt = stmt.where(AppUser.role == role.strip().upper())

        if status and status.strip():
            stmt = stmt.where(AppUser.status == status.strip().upper())

        # Total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = int(db.execute(count_stmt).scalar() or 0)

        # Ordering & Pagination
        stmt = stmt.order_by(AppUser.user_id.asc()).offset(skip).limit(limit)
        users = list(db.execute(stmt).scalars().all())

        return users, total_count

    @staticmethod
    def create(db: Session, user: AppUser) -> AppUser:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def save(db: Session, user: AppUser) -> AppUser:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

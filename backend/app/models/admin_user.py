from datetime import datetime
from sqlalchemy import Column, DateTime, String
from app.db.base import Base


class AdminUser(Base):
    """
    SQLAlchemy model mapping the existing `admin_users` table.
    References `workday_employees.user_id` via `admin_user_id`.
    """
    __tablename__ = "admin_users"

    admin_user_id = Column(String(100), primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<AdminUser(admin_user_id='{self.admin_user_id}')>"

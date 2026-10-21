from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from app.db.base import Base


class AppUser(Base):
    """
    SQLAlchemy model mapping the `app_users` table in PostgreSQL.
    Source of truth for AssetIQ portal authentication, user management, and RBAC.
    """
    __tablename__ = "app_users"

    user_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False, default="VIEWER")
    status = Column(String(20), nullable=False, default="ACTIVE")
    must_reset_password = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    @property
    def id(self) -> int:
        return self.user_id

    def __repr__(self) -> str:
        return f"<AppUser(user_id={self.user_id}, username='{self.username}', role='{self.role}', status='{self.status}')>"

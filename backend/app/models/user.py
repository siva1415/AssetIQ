from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, String, Text
from app.db.base import Base


class User(Base):
    """
    SQLAlchemy model for console user accounts.
    Maps to `users` table with RBAC and OTP governance.
    """
    __tablename__ = "users"

    username = Column(String(100), primary_key=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="viewer")
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    must_change_password = Column(Boolean, default=False)
    is_otp = Column(Boolean, default=False)
    is_root_protected = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    @property
    def password(self) -> str:
        return self.password_hash or ""

    @password.setter
    def password(self, val: str):
        self.password_hash = val

    def __repr__(self) -> str:
        return f"<User(username='{self.username}', role='{self.role}')>"


class ActiveSession(Base):
    """
    SQLAlchemy model for real-time logged-in console sessions.
    Maps to `active_sessions` table.
    """
    __tablename__ = "active_sessions"

    session_id = Column(String(100), primary_key=True, index=True)
    username = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False)
    login_time = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    last_active = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(Text, nullable=True)
    status = Column(String(50), default="active", index=True)

    def __repr__(self) -> str:
        return f"<ActiveSession(session_id='{self.session_id}', username='{self.username}', status='{self.status}')>"

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from app.db.base import Base


class AuditLog(Base):
    """
    SQLAlchemy model mapping the `audit_logs` table in PostgreSQL.
    Stores immutable audit trail for security, governance, and compliance.
    """
    __tablename__ = "audit_logs"

    audit_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    asset_tag = Column(String(100), nullable=True, index=True)
    portal_user_id = Column(Integer, nullable=True)
    portal_username = Column(String(100), nullable=True, index=True)
    portal_user_full_name = Column(String(150), nullable=True)
    portal_user_role = Column(String(50), nullable=True)
    category = Column(String(100), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=True)
    entity_name = Column(String(255), nullable=True)
    audit_finding = Column(Text, nullable=False)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    event_metadata = Column("metadata", JSON, nullable=True)
    status = Column(String(20), nullable=False, default="SUCCESS", index=True)
    detected_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog(audit_id={self.audit_id}, action='{self.action}', "
            f"category='{self.category}', actor='{self.portal_username}')>"
        )

from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


class AuditLogRepository:
    """
    Data access layer for AuditLog records in the `audit_logs` table.
    """

    @staticmethod
    def create(db: Session, entry: AuditLog) -> AuditLog:
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def bulk_create(db: Session, entries: List[AuditLog]) -> List[AuditLog]:
        if not entries:
            return []
        db.add_all(entries)
        db.commit()
        return entries

    @staticmethod
    def get_by_id(db: Session, audit_id: int) -> Optional[AuditLog]:
        return db.execute(select(AuditLog).where(AuditLog.audit_id == audit_id)).scalar_one_or_none()

    @classmethod
    def list_logs(
        cls,
        db: Session,
        skip: int = 0,
        limit: int = 25,
        search: Optional[str] = None,
        category: Optional[str] = None,
        action: Optional[str] = None,
        portal_username: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Tuple[List[AuditLog], int]:
        """
        Server-side filtered, paginated retrieval of audit logs sorted newest first.
        """
        stmt = select(AuditLog)

        # 1. Search across asset_tag, portal_username, entity_name, and audit_finding
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(AuditLog.asset_tag).like(term),
                    func.lower(AuditLog.portal_username).like(term),
                    func.lower(AuditLog.entity_name).like(term),
                    func.lower(AuditLog.audit_finding).like(term),
                )
            )

        # 2. Category filter
        if category and category.strip():
            stmt = stmt.where(func.lower(AuditLog.category) == category.strip().lower())

        # 3. Action filter
        if action and action.strip():
            stmt = stmt.where(func.lower(AuditLog.action) == action.strip().lower())

        # 4. Portal username filter
        if portal_username and portal_username.strip():
            stmt = stmt.where(
                func.lower(func.trim(AuditLog.portal_username)) == portal_username.strip().lower()
            )

        # 5. Status filter (SUCCESS / FAILURE)
        if status and status.strip():
            stmt = stmt.where(func.lower(AuditLog.status) == status.strip().lower())

        # 6. Date range filters
        if start_date:
            stmt = stmt.where(AuditLog.detected_at >= start_date)
        if end_date:
            stmt = stmt.where(AuditLog.detected_at <= end_date)

        # Count total matching records without loading into memory
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = int(db.execute(count_stmt).scalar() or 0)

        # Sort newest first, secondary by audit_id desc
        stmt = stmt.order_by(AuditLog.detected_at.desc(), AuditLog.audit_id.desc()).offset(skip).limit(limit)
        items = list(db.execute(stmt).scalars().all())

        return items, total_count

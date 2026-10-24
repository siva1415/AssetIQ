from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.models.app_user import AppUser
from app.models.audit_log import AuditLog
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.audit_log import AuditLogResponse


class AuditService:
    """
    Central service for recording immutable audit logs across:
    - Asset Ownership (single assign/reassign & bulk assign)
    - EOL Management (create, edit, delete model)
    - Ownership Management (add & remove admin users)
    - User Management (create, edit, status toggle, password reset)
    """

    @classmethod
    def record_audit(
        cls,
        db: Session,
        actor: Optional[AppUser],
        category: str,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        entity_name: Optional[str] = None,
        audit_finding: str = "",
        asset_tag: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        status: str = "SUCCESS",
        commit: bool = False,
    ) -> AuditLog:
        """
        Creates and persists a single audit log entry.
        Resolves actor securely from authenticated portal user entity.
        Never stores passwords, hashes, tokens, or secrets.
        """
        now = datetime.now(timezone.utc)

        # Sanitize sensitive fields in old_values / new_values
        clean_old = cls._sanitize_dictionary(old_values)
        clean_new = cls._sanitize_dictionary(new_values)
        clean_meta = cls._sanitize_dictionary(metadata)

        portal_user_id = actor.user_id if actor else None
        portal_username = actor.username if actor else "system"
        portal_user_full_name = actor.full_name if actor else None
        portal_user_role = actor.role if actor else None

        entry = AuditLog(
            asset_tag=asset_tag,
            portal_user_id=portal_user_id,
            portal_username=portal_username,
            portal_user_full_name=portal_user_full_name,
            portal_user_role=portal_user_role,
            category=category,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            entity_name=entity_name,
            audit_finding=audit_finding,
            old_values=clean_old,
            new_values=clean_new,
            event_metadata=clean_meta,
            status=status,
            detected_at=now,
        )

        db.add(entry)
        if commit:
            db.commit()
            db.refresh(entry)

        return entry

    @classmethod
    def record_bulk_audits(
        cls,
        db: Session,
        entries: List[AuditLog],
        commit: bool = False,
    ) -> List[AuditLog]:
        if not entries:
            return []
        try:
            if len(entries) > 50:
                for i in range(0, len(entries), 1000):
                    db.bulk_save_objects(entries[i:i + 1000])
            else:
                db.add_all(entries)
            if commit:
                db.commit()
        except Exception as exc:
            logger.warning(f"bulk_save_objects encountered error: {exc}; falling back to add_all")
            db.add_all(entries)
            if commit:
                db.commit()
        return entries

    @classmethod
    def list_audit_logs(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        category: Optional[str] = None,
        action: Optional[str] = None,
        portal_username: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Tuple[List[AuditLogResponse], int]:
        skip = (page - 1) * page_size
        items, total = AuditLogRepository.list_logs(
            db=db,
            skip=skip,
            limit=page_size,
            search=search,
            category=category,
            action=action,
            portal_username=portal_username,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )

        response_items = [AuditLogResponse.model_validate(item) for item in items]
        return response_items, total

    @classmethod
    def get_audit_log_by_id(cls, db: Session, audit_id: int) -> Optional[AuditLogResponse]:
        item = AuditLogRepository.get_by_id(db, audit_id)
        if not item:
            return None
        return AuditLogResponse.model_validate(item)

    @staticmethod
    def _sanitize_dictionary(data: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not data:
            return None
        sanitized = {}
        sensitive_keys = {
            "password",
            "password_hash",
            "token",
            "access_token",
            "secret",
            "jwt",
            "current_password",
            "new_password",
        }
        for k, v in data.items():
            if any(s in k.lower() for s in sensitive_keys):
                continue
            sanitized[k] = v
        return sanitized

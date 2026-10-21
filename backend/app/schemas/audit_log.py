from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AuditLogResponse(BaseModel):
    """
    Schema for serialized audit log entry.
    """
    audit_id: int
    asset_tag: Optional[str] = None
    portal_user_id: Optional[int] = None
    portal_username: Optional[str] = None
    portal_user_full_name: Optional[str] = None
    portal_user_role: Optional[str] = None
    category: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    audit_finding: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="metadata")
    status: str = "SUCCESS"
    detected_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("detected_at", mode="after")
    @classmethod
    def ensure_detected_at_tz_aware(cls, v: datetime) -> datetime:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @model_validator(mode="before")
    @classmethod
    def map_event_metadata(cls, values: Any) -> Any:
        if hasattr(values, "event_metadata"):
            # ORM object instance
            meta = getattr(values, "event_metadata", None)
            return {
                "audit_id": values.audit_id,
                "asset_tag": values.asset_tag,
                "portal_user_id": values.portal_user_id,
                "portal_username": values.portal_username,
                "portal_user_full_name": values.portal_user_full_name,
                "portal_user_role": values.portal_user_role,
                "category": values.category,
                "action": values.action,
                "entity_type": values.entity_type,
                "entity_id": values.entity_id,
                "entity_name": values.entity_name,
                "audit_finding": values.audit_finding,
                "old_values": values.old_values,
                "new_values": values.new_values,
                "metadata": meta,
                "status": values.status,
                "detected_at": values.detected_at,
            }
        elif isinstance(values, dict):
            if "metadata" not in values and "event_metadata" in values:
                values["metadata"] = values["event_metadata"]
        return values

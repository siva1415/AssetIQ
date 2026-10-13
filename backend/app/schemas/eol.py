from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class EolInfo(BaseModel):
    """
    Calculated EOL lifecycle status metadata.
    """
    eol_date: Optional[date] = None
    days_remaining: Optional[int] = None
    eol_status: str = Field(..., description="ACTIVE, EOL SOON, EXPIRED, or UNKNOWN")
    reference_source: Optional[str] = None


class EolAssetItem(BaseModel):
    """
    Asset with associated EOL lifecycle evaluation.
    """
    asset_id: int
    asset_number: str
    serial_number: Optional[str] = None
    source: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    os_name: Optional[str] = None
    macaddress: Optional[str] = None
    devicetype: Optional[str] = None
    managed_by: Optional[str] = None
    assigned_username: Optional[str] = None
    asset_status: Optional[str] = None
    assignment_type: Optional[str] = None
    lastreporttime: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    eol_date: Optional[date] = None
    days_remaining: Optional[int] = None
    eol_status: str
    reference_source: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="ignore")


class EolSummaryResponse(BaseModel):
    """
    Dashboard lifecycle & EOL aggregate counts.
    """
    active_count: int = Field(..., ge=0, description="Devices whose EOL date is beyond warning threshold")
    nearing_eol_count: int = Field(..., ge=0, description="Devices within warning window")
    expired_count: int = Field(..., ge=0, description="Devices whose EOL date has already passed")
    unknown_count: int = Field(..., ge=0, description="Devices with missing EOL reference date")
    warning_threshold_days: int = Field(..., description="Configured threshold in days")
    total_evaluated: int = Field(..., ge=0)

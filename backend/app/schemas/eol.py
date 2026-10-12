from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class EolInfo(BaseModel):
    """
    Calculated EOL lifecycle status metadata.
    """
    eol_date: Optional[date] = None
    days_remaining: Optional[int] = None
    eol_status: str = Field(..., description="Active, Nearing EOL, Expired, or Unknown")
    reference_source: Optional[str] = None


class EolAssetItem(BaseModel):
    """
    Asset with associated EOL lifecycle evaluation.
    """
    asset_id: int
    asset_number: str
    serial_number: str
    source: Optional[str] = None
    manufacturer: str
    model: str
    os_name: str
    devicetype: Optional[str] = None
    assigned_username: Optional[str] = None
    asset_status: Optional[str] = None
    assignment_type: Optional[str] = None
    eol_date: Optional[date] = None
    days_remaining: Optional[int] = None
    eol_status: str
    reference_source: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


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

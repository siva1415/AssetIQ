from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


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


class EolDistributionItem(BaseModel):
    status: str
    count: int = Field(0, ge=0)


class EolSummaryResponse(BaseModel):
    """
    Dashboard lifecycle & EOL aggregate counts.
    Always returns counts for all four EOL states in stable order:
    ACTIVE, EOL SOON, EXPIRED, UNKNOWN.
    """
    active_count: int = Field(..., ge=0, description="Devices whose EOL date is beyond warning threshold")
    nearing_eol_count: int = Field(..., ge=0, description="Devices within warning window")
    expired_count: int = Field(..., ge=0, description="Devices whose EOL date has already passed")
    unknown_count: int = Field(..., ge=0, description="Devices with missing EOL reference date")
    warning_threshold_days: int = Field(..., description="Configured threshold in days")
    total_evaluated: int = Field(..., ge=0)

    # Array representation for dashboard charts
    distribution: Optional[list[EolDistributionItem]] = None
    eol_distribution: Optional[list[EolDistributionItem]] = None
    items: Optional[list[EolDistributionItem]] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_distribution(cls, data: Any) -> Any:
        if isinstance(data, dict):
            act = data.get("active_count", 0) or 0
            near = data.get("nearing_eol_count", 0) or 0
            exp = data.get("expired_count", 0) or 0
            unk = data.get("unknown_count", 0) or 0
            dist = [
                {"status": "ACTIVE", "count": act},
                {"status": "EOL SOON", "count": near},
                {"status": "EXPIRED", "count": exp},
                {"status": "UNKNOWN", "count": unk},
            ]
            data["distribution"] = dist
            data["eol_distribution"] = dist
            data["items"] = dist
        return data

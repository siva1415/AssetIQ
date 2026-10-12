from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class EmployeeSummary(BaseModel):
    """
    Summary of Workday Employee for correlations and references.
    """
    employee_id: int
    user_id: str
    full_name: str
    email_work: Optional[str] = None
    department: Optional[str] = None
    division: Optional[str] = None
    job_title: Optional[str] = None
    employee_status: Optional[str] = None
    location: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeResponse(EmployeeSummary):
    """
    Full employee profile view.
    """
    email_home: Optional[str] = None
    manager_user_name: Optional[str] = None
    manager_name: Optional[str] = None
    hire_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None


class AssignedAssetSummary(BaseModel):
    """
    Asset summary nested inside an employee detail record.
    """
    asset_id: int
    asset_number: str
    serial_number: str
    source: Optional[str] = None
    manufacturer: str
    model: str
    os_name: str
    devicetype: Optional[str] = None
    asset_status: Optional[str] = None
    assignment_type: Optional[str] = None
    lastreporttime: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeDetailResponse(EmployeeResponse):
    """
    Detailed employee profile with correlated assets.
    """
    assigned_assets: List[AssignedAssetSummary] = []
    assigned_assets_count: int = 0

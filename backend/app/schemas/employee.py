from datetime import date, datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, model_validator


class EmployeeSummary(BaseModel):
    """
    Summary of Workday Employee for correlations and references.
    Supports both snake_case and camelCase for seamless frontend consumption.
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

    # camelCase aliases
    employeeId: Optional[int] = None
    userId: Optional[str] = None
    fullName: Optional[str] = None
    emailWork: Optional[str] = None
    jobTitle: Optional[str] = None
    employeeStatus: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def sync_employee_summary_fields(cls, data: Any) -> Any:
        if hasattr(data, "__dict__") and not isinstance(data, dict):
            # SQLAlchemy model instance
            d = {
                "employee_id": getattr(data, "employee_id", None),
                "user_id": getattr(data, "user_id", None),
                "full_name": getattr(data, "full_name", None),
                "email_work": getattr(data, "email_work", None),
                "department": getattr(data, "department", None),
                "division": getattr(data, "division", None),
                "job_title": getattr(data, "job_title", None),
                "employee_status": getattr(data, "employee_status", None),
                "location": getattr(data, "location", None),
            }
            data = d
        if isinstance(data, dict):
            eid = data.get("employee_id", data.get("employeeId"))
            data["employee_id"] = eid
            data["employeeId"] = eid

            uid = data.get("user_id", data.get("userId"))
            data["user_id"] = uid
            data["userId"] = uid

            fn = data.get("full_name", data.get("fullName"))
            data["full_name"] = fn
            data["fullName"] = fn

            ew = data.get("email_work", data.get("emailWork"))
            data["email_work"] = ew
            data["emailWork"] = ew

            jt = data.get("job_title", data.get("jobTitle"))
            data["job_title"] = jt
            data["jobTitle"] = jt

            es = data.get("employee_status", data.get("employeeStatus"))
            data["employee_status"] = es
            data["employeeStatus"] = es
        return data


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

    # camelCase aliases
    emailHome: Optional[str] = None
    managerUserName: Optional[str] = None
    managerName: Optional[str] = None
    hireDate: Optional[date] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    lastSyncedAt: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def sync_employee_response_fields(cls, data: Any) -> Any:
        if hasattr(data, "__dict__") and not isinstance(data, dict):
            # SQLAlchemy model instance
            d = {
                "employee_id": getattr(data, "employee_id", None),
                "user_id": getattr(data, "user_id", None),
                "full_name": getattr(data, "full_name", None),
                "email_work": getattr(data, "email_work", None),
                "email_home": getattr(data, "email_home", None),
                "department": getattr(data, "department", None),
                "division": getattr(data, "division", None),
                "job_title": getattr(data, "job_title", None),
                "employee_status": getattr(data, "employee_status", None),
                "manager_user_name": getattr(data, "manager_user_name", None),
                "manager_name": getattr(data, "manager_name", None),
                "location": getattr(data, "location", None),
                "hire_date": getattr(data, "hire_date", None),
                "created_at": getattr(data, "created_at", None),
                "updated_at": getattr(data, "updated_at", None),
                "last_synced_at": getattr(data, "last_synced_at", None),
            }
            data = d
        if isinstance(data, dict):
            eid = data.get("employee_id", data.get("employeeId"))
            data["employee_id"] = eid
            data["employeeId"] = eid

            uid = data.get("user_id", data.get("userId"))
            data["user_id"] = uid
            data["userId"] = uid

            fn = data.get("full_name", data.get("fullName"))
            data["full_name"] = fn
            data["fullName"] = fn

            ew = data.get("email_work", data.get("emailWork"))
            data["email_work"] = ew
            data["emailWork"] = ew

            jt = data.get("job_title", data.get("jobTitle"))
            data["job_title"] = jt
            data["jobTitle"] = jt

            es = data.get("employee_status", data.get("employeeStatus"))
            data["employee_status"] = es
            data["employeeStatus"] = es

            data["emailHome"] = data.get("email_home", data.get("emailHome"))
            data["managerUserName"] = data.get("manager_user_name", data.get("managerUserName"))
            data["managerName"] = data.get("manager_name", data.get("managerName"))
            data["hireDate"] = data.get("hire_date", data.get("hireDate"))
            data["createdAt"] = data.get("created_at", data.get("createdAt"))
            data["updatedAt"] = data.get("updated_at", data.get("updatedAt"))
            data["lastSyncedAt"] = data.get("last_synced_at", data.get("lastSyncedAt"))
        return data


class AssignedAssetSummary(BaseModel):
    """
    Asset summary nested inside an employee detail record.
    Canonical lowercase fields without duplicate aliases.
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

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def sync_assigned_asset_fields(cls, data: Any) -> Any:
        if hasattr(data, "__dict__") and not isinstance(data, dict):
            d = {
                "asset_id": getattr(data, "asset_id", None),
                "asset_number": getattr(data, "asset_number", None),
                "serial_number": getattr(data, "serial_number", None),
                "source": getattr(data, "source", None),
                "manufacturer": getattr(data, "manufacturer", None),
                "model": getattr(data, "model", None),
                "os_name": getattr(data, "os_name", None),
                "macaddress": getattr(data, "macaddress", None),
                "devicetype": getattr(data, "devicetype", None),
                "managed_by": getattr(data, "managed_by", None),
                "assigned_username": getattr(data, "assigned_username", None),
                "asset_status": getattr(data, "asset_status", None),
                "assignment_type": getattr(data, "assignment_type", None),
                "lastreporttime": getattr(data, "lastreporttime", None),
                "last_synced_at": getattr(data, "last_synced_at", None),
            }
            data = d
        if isinstance(data, dict):
            if data.get("asset_id") is None and data.get("assetId") is not None:
                data["asset_id"] = data["assetId"]
            if data.get("asset_number") is None and data.get("assetNumber") is not None:
                data["asset_number"] = data["assetNumber"]
            if data.get("serial_number") is None and data.get("serialNumber") is not None:
                data["serial_number"] = data["serialNumber"]
            if data.get("os_name") is None and data.get("osName") is not None:
                data["os_name"] = data["osName"]
            if data.get("macaddress") is None and data.get("macAddress") is not None:
                data["macaddress"] = data["macAddress"]
            if data.get("devicetype") is None and data.get("deviceType") is not None:
                data["devicetype"] = data["deviceType"]
            if data.get("managed_by") is None and data.get("managedBy") is not None:
                data["managed_by"] = data["managedBy"]
            if data.get("assigned_username") is None and data.get("assignedUsername") is not None:
                data["assigned_username"] = data["assignedUsername"]
            if data.get("asset_status") is None and data.get("assetStatus") is not None:
                data["asset_status"] = data["assetStatus"]
            if data.get("assignment_type") is None and data.get("assignmentType") is not None:
                data["assignment_type"] = data["assignmentType"]
            if data.get("lastreporttime") is None and data.get("lastReportTime") is not None:
                data["lastreporttime"] = data["lastReportTime"]
            if data.get("last_synced_at") is None and data.get("lastSyncedAt") is not None:
                data["last_synced_at"] = data["lastSyncedAt"]
        return data


class EmployeeDetailResponse(EmployeeResponse):
    """
    Detailed employee profile with correlated assets.
    """
    assigned_assets: List[AssignedAssetSummary] = []
    assigned_assets_count: int = 0


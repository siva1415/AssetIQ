from datetime import datetime
from typing import Any, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.schemas.employee import EmployeeSummary


class AdminUserResponse(BaseModel):
    """
    Admin user joined with Workday employee details.
    """
    admin_user_id: str
    adminUserId: Optional[str] = None
    user_id: Optional[str] = None
    userId: Optional[str] = None
    created_at: Optional[datetime] = None

    # Workday Employee Joined Fields
    full_name: Optional[str] = None
    fullName: Optional[str] = None
    email_work: Optional[str] = None
    emailWork: Optional[str] = None
    department: Optional[str] = None
    division: Optional[str] = None
    job_title: Optional[str] = None
    jobTitle: Optional[str] = None
    employee_status: Optional[str] = None
    employeeStatus: Optional[str] = None
    manager_name: Optional[str] = None
    manager_user_name: Optional[str] = None
    location: Optional[str] = None

    # Nested employee representation
    employee: Optional[EmployeeSummary] = None
    workday_employee: Optional[EmployeeSummary] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            auid = data.get("admin_user_id", data.get("adminUserId", data.get("user_id", data.get("userId"))))
            data["admin_user_id"] = auid
            data["adminUserId"] = auid
            data["user_id"] = auid
            data["userId"] = auid

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

            emp = data.get("employee", data.get("workday_employee"))
            if emp:
                data["employee"] = emp
                data["workday_employee"] = emp
        return data


class AdminUserCreateItem(BaseModel):
    admin_user_id: str
    adminUserId: Optional[str] = None
    user_id: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sync_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            val = data.get("admin_user_id") or data.get("adminUserId") or data.get("user_id") or data.get("userId")
            if val:
                data["admin_user_id"] = str(val).strip()
        elif isinstance(data, str):
            return {"admin_user_id": data.strip()}
        return data


class AdminUserCreateRequest(BaseModel):
    """
    Flexible payload to support single user, list of users, or object with list.
    """
    admin_user_id: Optional[str] = None
    user_id: Optional[str] = None
    admin_user_ids: Optional[List[str]] = None
    user_ids: Optional[List[str]] = None
    users: Optional[List[AdminUserCreateItem]] = None

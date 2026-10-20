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
    Accepts `user_ids: ["EMP001", "EMP002"]`, `admin_user_ids`, single IDs, or items.
    """
    admin_user_id: Optional[str] = None
    adminUserId: Optional[str] = None
    user_id: Optional[str] = None
    userId: Optional[str] = None
    admin_user_ids: Optional[List[str]] = None
    adminUserIds: Optional[List[str]] = None
    user_ids: Optional[List[str]] = None
    userIds: Optional[List[str]] = None
    users: Optional[List[Union[str, AdminUserCreateItem]]] = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class AvailableAdminUserItem(BaseModel):
    """
    Workday employee eligible for admin assignment.
    """
    user_id: str
    userId: Optional[str] = None
    full_name: str
    fullName: Optional[str] = None
    email_work: Optional[str] = None
    emailWork: Optional[str] = None
    employee_status: Optional[str] = None
    employeeStatus: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            uid = data.get("user_id", data.get("userId"))
            data["user_id"] = uid
            data["userId"] = uid

            fn = data.get("full_name", data.get("fullName"))
            data["full_name"] = fn
            data["fullName"] = fn

            ew = data.get("email_work", data.get("emailWork"))
            data["email_work"] = ew
            data["emailWork"] = ew

            es = data.get("employee_status", data.get("employeeStatus"))
            data["employee_status"] = es
            data["employeeStatus"] = es
        elif hasattr(data, "user_id"):
            return {
                "user_id": data.user_id,
                "userId": data.user_id,
                "full_name": data.full_name,
                "fullName": data.full_name,
                "email_work": data.email_work,
                "emailWork": data.email_work,
                "employee_status": data.employee_status,
                "employeeStatus": data.employee_status,
                "department": getattr(data, "department", None),
                "job_title": getattr(data, "job_title", None),
            }
        return data


class AdminUserSummaryItem(BaseModel):
    user_id: str
    admin_user_id: Optional[str] = None
    full_name: Optional[str] = None
    email_work: Optional[str] = None
    employee_status: Optional[str] = None
    department: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def sync_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            uid = data.get("user_id", data.get("admin_user_id"))
            data["user_id"] = uid
            data["admin_user_id"] = uid
        return data


class AdminUserBulkResponse(BaseModel):
    """
    Summary response for bulk admin user authorization.
    """
    message: str = "Admin users processed successfully"
    inserted: List[AdminUserSummaryItem] = Field(default_factory=list)
    skipped: List[str] = Field(default_factory=list, description="User IDs skipped (already admins or duplicate entries)")
    invalid: List[str] = Field(default_factory=list, description="User IDs not found in Workday HCM")
    total_inserted: int = 0
    total_skipped: int = 0
    total_invalid: int = 0
    admin_users: List[AdminUserResponse] = Field(default_factory=list, description="Updated full list of authorized admin users")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


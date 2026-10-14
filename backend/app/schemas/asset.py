from datetime import date, datetime
from typing import Any, Optional, Union
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from app.schemas.employee import EmployeeSummary
from app.schemas.eol import EolInfo


class AssetResponse(BaseModel):
    """
    Canonical Asset response model exposing exactly one canonical lowercase
    property for each logical field without redundant alias duplications.
    """
    # Primary Identifiers
    asset_id: int
    asset_number: str
    serial_number: Optional[str] = None

    # Telemetry and Hardware Specs
    source: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    os_name: Optional[str] = None
    macaddress: Optional[str] = None
    devicetype: Optional[str] = None
    managed_by: Optional[str] = None

    # Reporting & Fleet Status
    assigned_username: Optional[str] = None
    lastreporttime: Optional[datetime] = None
    asset_status: Optional[str] = None
    assignment_type: Optional[str] = None
    remarks: Optional[str] = None

    # EOL Lifecycle Governance
    eol_date: Optional[date] = None
    days_remaining: Optional[int] = None
    eol_status: str = "UNKNOWN"
    reference_source: Optional[str] = None
    eol_info: Optional[EolInfo] = None

    # Workday HCM Correlation & Ownership
    workday_status: str = "No assigned username"
    ownership_status: str = "UNASSIGNED"

    # Correlated Employee Details (flattened + nested for UI compatibility)
    full_name: Optional[str] = None
    employee_user_id: Optional[str] = None
    email_work: Optional[str] = None
    department: Optional[str] = None
    division: Optional[str] = None
    job_title: Optional[str] = None
    employee_status: Optional[str] = None
    manager_name: Optional[str] = None
    manager_user_name: Optional[str] = None
    location: Optional[str] = None
    matched_employee: Optional[EmployeeSummary] = None

    # Audit Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases_to_canonical(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize incoming dictionary keys to canonical properties if canonical is missing
            if data.get("asset_id") is None and data.get("assetId") is not None:
                data["asset_id"] = data["assetId"]
            elif data.get("asset_id") is None and data.get("AssetID") is not None:
                data["asset_id"] = data["AssetID"]

            if data.get("asset_number") is None and data.get("assetNumber") is not None:
                data["asset_number"] = data["assetNumber"]

            if data.get("serial_number") is None and data.get("serialNumber") is not None:
                data["serial_number"] = data["serialNumber"]

            if data.get("os_name") is None and data.get("osName") is not None:
                data["os_name"] = data["osName"]

            if data.get("macaddress") is None and data.get("macAddress") is not None:
                data["macaddress"] = data["macAddress"]

            if data.get("devicetype") is None:
                data["devicetype"] = data.get("deviceType") or data.get("DeviceType")

            if data.get("managed_by") is None and data.get("managedBy") is not None:
                data["managed_by"] = data["managedBy"]

            if data.get("assigned_username") is None and data.get("assignedUsername") is not None:
                data["assigned_username"] = data["assignedUsername"]

            if data.get("lastreporttime") is None:
                data["lastreporttime"] = (
                    data.get("lastReportTime")
                    or data.get("last_discovery_date")
                    or data.get("lastDiscoveryDate")
                    or data.get("LastDiscoveryDate")
                )

            if data.get("asset_status") is None and data.get("assetStatus") is not None:
                data["asset_status"] = data["assetStatus"]

            if data.get("manufacturer") is None and data.get("Manufacturer") is not None:
                data["manufacturer"] = data["Manufacturer"]

            if data.get("model") is None and data.get("Model") is not None:
                data["model"] = data["Model"]

            if data.get("source") is None and data.get("Source") is not None:
                data["source"] = data["Source"]

            if data.get("last_synced_at") is None and data.get("lastSyncedAt") is not None:
                data["last_synced_at"] = data["lastSyncedAt"]

            if data.get("assignment_type") is None and data.get("assignmentType") is not None:
                data["assignment_type"] = data["assignmentType"]

            if data.get("eol_date") is None and data.get("eolDate") is not None:
                data["eol_date"] = data["eolDate"]

            if data.get("days_remaining") is None and data.get("daysRemaining") is not None:
                data["days_remaining"] = data["daysRemaining"]

            if data.get("eol_status") is None and data.get("eolStatus") is not None:
                data["eol_status"] = data["eolStatus"]

            if data.get("reference_source") is None and data.get("referenceSource") is not None:
                data["reference_source"] = data["referenceSource"]

            if data.get("eol_info") is None and data.get("eolInfo") is not None:
                data["eol_info"] = data["eolInfo"]

            if data.get("workday_status") is None and data.get("workdayStatus") is not None:
                data["workday_status"] = data["workdayStatus"]

            if data.get("ownership_status") is None:
                data["ownership_status"] = (
                    data.get("ownershipStatus")
                    or data.get("correlation_status")
                    or data.get("correlationStatus")
                    or "UNASSIGNED"
                )

            if data.get("full_name") is None:
                data["full_name"] = (
                    data.get("fullName")
                    or data.get("employee_name")
                    or data.get("employeeName")
                )

            if data.get("email_work") is None and data.get("emailWork") is not None:
                data["email_work"] = data["emailWork"]

            if data.get("job_title") is None and data.get("jobTitle") is not None:
                data["job_title"] = data["jobTitle"]

            if data.get("employee_status") is None and data.get("employeeStatus") is not None:
                data["employee_status"] = data["employeeStatus"]

            if data.get("manager_name") is None and data.get("managerName") is not None:
                data["manager_name"] = data["managerName"]

            if data.get("manager_user_name") is None and data.get("managerUserName") is not None:
                data["manager_user_name"] = data["managerUserName"]

            if data.get("matched_employee") is None:
                data["matched_employee"] = (
                    data.get("correlated_employee")
                    or data.get("employee")
                )

        return data


class AssetDetailResponse(AssetResponse):
    """
    Detailed Asset record including deep correlated Workday employee profile
    and computed EOL references.
    """
    pass


class AssetAssignmentRequest(BaseModel):
    """
    Request model for assigning, reassigning, or updating an asset.
    Accommodates snake_case, camelCase, and alternate parameter names from the UI popup.
    """
    asset_id: Optional[int] = None
    assetId: Optional[int] = None
    AssetID: Optional[Union[int, str]] = None

    # Telemetry and Hardware Specs
    serial_number: Optional[str] = None
    source: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    os_name: Optional[str] = None
    macaddress: Optional[str] = None
    devicetype: Optional[str] = None
    lastreporttime: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None

    managed_by: Optional[str] = None
    managedBy: Optional[str] = None
    management_group: Optional[str] = None
    managementGroup: Optional[str] = None

    assigned_username: Optional[str] = None
    assignedUsername: Optional[str] = None
    user_id: Optional[str] = None
    userId: Optional[str] = None
    username: Optional[str] = None
    employee_id: Optional[int] = None
    employeeId: Optional[int] = None

    asset_status: Optional[str] = None
    assetStatus: Optional[str] = None
    status: Optional[str] = None

    assignment_type: Optional[str] = None
    assignmentType: Optional[str] = None

    remarks: Optional[str] = None
    remark: Optional[str] = None
    notes: Optional[str] = None
    comment: Optional[str] = None

    @field_validator("asset_status", "assetStatus", "status", mode="after")
    @classmethod
    def validate_asset_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        allowed_statuses = {"ACTIVE", "REVIEW", "IN STOCK", "RETIRED"}
        if v not in allowed_statuses:
            raise ValueError(
                f"Invalid asset_status '{v}'. Allowed values are: 'ACTIVE', 'REVIEW', 'IN STOCK', 'RETIRED'"
            )
        return v

    @field_validator("assignment_type", "assignmentType", mode="after")
    @classmethod
    def validate_assignment_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip().upper()
        if clean in ("AUTO", "MANUAL"):
            return clean
        raise ValueError(
            f"Invalid assignment_type '{v}'. Allowed values are: 'AUTO', 'MANUAL'"
        )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class AssetUpdateRequest(AssetAssignmentRequest):
    """
    Request model for partial or full updates of asset records.
    """
    pass


class AssetCreateRequest(AssetAssignmentRequest):
    """
    Request model for creating an asset with optional/nullable fields.
    """
    asset_number: Optional[str] = None


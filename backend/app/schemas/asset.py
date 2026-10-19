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


class BulkAssetAssignmentItemResult(BaseModel):
    """
    Per-asset result for bulk assignment.
    """
    asset_id: int
    asset_number: Optional[str] = None
    status: str  # "SUCCESS" or "FAILED"
    reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class BulkAssetAssignmentResponse(BaseModel):
    """
    Aggregate response schema for bulk asset assignment.
    """
    message: str
    requested_count: int
    success_count: int
    failure_count: int
    results: list[BulkAssetAssignmentItemResult]

    # Additional metadata fields for select-all & outcome display
    matched_count: Optional[int] = None
    assigned_count: Optional[int] = None
    target_username: Optional[str] = None
    managed_by: Optional[str] = None
    assignment_type: Optional[str] = None
    asset_status: Optional[str] = None

    # camelCase aliases
    requestedCount: Optional[int] = None
    successCount: Optional[int] = None
    failureCount: Optional[int] = None
    matchedCount: Optional[int] = None
    assignedCount: Optional[int] = None
    targetUsername: Optional[str] = None
    managedBy: Optional[str] = None
    assignmentType: Optional[str] = None
    assetStatus: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def sync_bulk_response_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            req_c = data.get("requested_count", data.get("requestedCount", 0))
            data["requested_count"] = req_c
            data["requestedCount"] = req_c

            succ_c = data.get("success_count", data.get("successCount", 0))
            data["success_count"] = succ_c
            data["successCount"] = succ_c

            fail_c = data.get("failure_count", data.get("failureCount", 0))
            data["failure_count"] = fail_c
            data["failureCount"] = fail_c

            match_c = data.get("matched_count", data.get("matchedCount", req_c))
            data["matched_count"] = match_c
            data["matchedCount"] = match_c

            ass_c = data.get("assigned_count", data.get("assignedCount", succ_c))
            data["assigned_count"] = ass_c
            data["assignedCount"] = ass_c

            t_user = data.get("target_username", data.get("targetUsername"))
            if t_user is not None:
                data["target_username"] = t_user
                data["targetUsername"] = t_user

            mby = data.get("managed_by", data.get("managedBy"))
            if mby is not None:
                data["managed_by"] = mby
                data["managedBy"] = mby

            atype = data.get("assignment_type", data.get("assignmentType"))
            if atype is not None:
                data["assignment_type"] = atype
                data["assignmentType"] = atype

            astat = data.get("asset_status", data.get("assetStatus"))
            if astat is not None:
                data["asset_status"] = astat
                data["assetStatus"] = astat
        return data


class BulkAssetAssignmentRequest(BaseModel):
    """
    Request payload for bulk assigning multiple assets to one active Workday employee.
    Supports either individual asset IDs or select-all across all pages with search & filters.
    """
    asset_ids: Optional[list[int]] = None
    assigned_username: str
    managed_by: Optional[str] = "INDIVIDUAL"
    remarks: Optional[str] = None

    # Select-all matching assets mode
    select_all: Optional[bool] = False

    # Filters dictionary (if sent as nested object from frontend)
    filters: Optional[dict[str, Any]] = None

    # Direct search & filter fields (if sent at top level)
    search: Optional[str] = None
    source: Optional[str] = None
    asset_status: Optional[str] = None
    devicetype: Optional[str] = None
    device_type: Optional[str] = None
    deviceType: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    filter_assigned_username: Optional[str] = None
    assignment_type: Optional[str] = None
    is_unassigned: Optional[bool] = None
    eol_status: Optional[str] = None
    scope: Optional[str] = None
    report: Optional[str] = None

    # Aliases
    assetIds: Optional[list[int]] = None
    assignedUsername: Optional[str] = None
    user_id: Optional[str] = None
    userId: Optional[str] = None
    username: Optional[str] = None
    managedBy: Optional[str] = None
    management_group: Optional[str] = None
    managementGroup: Optional[str] = None
    remark: Optional[str] = None
    notes: Optional[str] = None
    comment: Optional[str] = None

    # Select-all aliases
    selectAll: Optional[bool] = None
    select_all_matching: Optional[bool] = None
    selectAllMatching: Optional[bool] = None
    all_matching: Optional[bool] = None
    allMatching: Optional[bool] = None
    match_all: Optional[bool] = None
    matchAll: Optional[bool] = None

    # Filter aliases
    status: Optional[str] = None
    assetStatus: Optional[str] = None
    assignmentType: Optional[str] = None
    isUnassigned: Optional[bool] = None
    eolStatus: Optional[str] = None
    report_name: Optional[str] = None
    reportName: Optional[str] = None
    card: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def sync_bulk_request_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # 1. Select-all aliases
            sel_all = (
                data.get("select_all")
                or data.get("selectAll")
                or data.get("select_all_matching")
                or data.get("selectAllMatching")
                or data.get("all_matching")
                or data.get("allMatching")
                or data.get("match_all")
                or data.get("matchAll")
            )
            if sel_all is not None:
                data["select_all"] = bool(sel_all)

            # 2. Asset IDs
            aids = data.get("asset_ids", data.get("assetIds"))
            if aids is not None:
                data["asset_ids"] = aids

            # 3. Assigned Username
            uname = (
                data.get("assigned_username")
                or data.get("assignedUsername")
                or data.get("user_id")
                or data.get("userId")
                or data.get("username")
            )
            if uname is not None:
                data["assigned_username"] = uname

            # 4. Managed By
            mby = (
                data.get("managed_by")
                if "managed_by" in data
                else (
                    data.get("managedBy")
                    if "managedBy" in data
                    else (
                        data.get("management_group")
                        if "management_group" in data
                        else data.get("managementGroup")
                    )
                )
            )
            if mby is not None:
                data["managed_by"] = mby

            # 5. Remarks
            rem = (
                data.get("remarks")
                if "remarks" in data
                else (
                    data.get("remark")
                    if "remark" in data
                    else (data.get("notes") if "notes" in data else data.get("comment"))
                )
            )
            if rem is not None:
                data["remarks"] = rem

            # 6. Extract nested filters if passed as a dictionary
            raw_filters = data.get("filters")
            if isinstance(raw_filters, dict):
                for k, v in raw_filters.items():
                    if k not in data or data[k] is None:
                        data[k] = v
                    if k in ("assigned_username", "assignedUsername", "user", "filter_user"):
                        data["filter_assigned_username"] = v

            # 7. Normalize filter aliases
            if not data.get("devicetype") and (data.get("device_type") or data.get("deviceType")):
                data["devicetype"] = data.get("device_type") or data.get("deviceType")
            if not data.get("asset_status") and (data.get("status") or data.get("assetStatus")):
                data["asset_status"] = data.get("status") or data.get("assetStatus")
            if not data.get("assignment_type") and data.get("assignmentType"):
                data["assignment_type"] = data.get("assignmentType")
            if data.get("is_unassigned") is None and data.get("isUnassigned") is not None:
                data["is_unassigned"] = data.get("isUnassigned")
            if not data.get("eol_status") and data.get("eolStatus"):
                data["eol_status"] = data.get("eolStatus")
            if not data.get("report") and (data.get("report_name") or data.get("reportName") or data.get("card")):
                data["report"] = data.get("report_name") or data.get("reportName") or data.get("card")
        return data



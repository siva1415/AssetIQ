from datetime import date, datetime
from typing import Any, Optional, Union
from pydantic import BaseModel, ConfigDict, model_validator
from app.schemas.employee import EmployeeSummary
from app.schemas.eol import EolInfo


class AssetResponse(BaseModel):
    """
    Unified Asset response model supporting both snake_case and camelCase field mappings
    expected by the frontend across All Assets, Windows, Mac, and Ownership pages.
    """
    # Primary Identifiers
    asset_id: int
    assetId: Optional[int] = None
    AssetID: Optional[Union[int, str]] = None
    asset_number: str
    assetNumber: Optional[str] = None
    serial_number: str
    serialNumber: Optional[str] = None

    # Telemetry and Hardware Specs
    source: Optional[str] = None
    manufacturer: str
    model: str
    os_name: str
    osName: Optional[str] = None
    macaddress: Optional[str] = None
    macAddress: Optional[str] = None
    devicetype: Optional[str] = None
    deviceType: Optional[str] = None
    DeviceType: Optional[str] = None
    managed_by: Optional[str] = None
    managedBy: Optional[str] = None

    # Reporting & Fleet Status
    lastreporttime: Optional[datetime] = None
    lastReportTime: Optional[datetime] = None
    last_discovery_date: Optional[datetime] = None
    lastDiscoveryDate: Optional[datetime] = None
    LastDiscoveryDate: Optional[datetime] = None
    asset_status: Optional[str] = None
    assetStatus: Optional[str] = None
    assignment_type: Optional[str] = None
    assignmentType: Optional[str] = None
    remarks: Optional[str] = None

    # EOL Lifecycle Governance
    eol_date: Optional[date] = None
    eolDate: Optional[date] = None
    days_remaining: Optional[int] = None
    daysRemaining: Optional[int] = None
    eol_status: str = "Unknown"
    eolStatus: str = "Unknown"
    reference_source: Optional[str] = None
    referenceSource: Optional[str] = None
    eol_info: Optional[EolInfo] = None
    eolInfo: Optional[EolInfo] = None

    # Workday HCM Correlation & Ownership
    assigned_username: Optional[str] = None
    assignedUsername: Optional[str] = None
    workday_status: str = "No assigned username"
    workdayStatus: str = "No assigned username"
    ownership_status: str = "UNASSIGNED"
    ownershipStatus: str = "UNASSIGNED"
    correlation_status: str = "UNASSIGNED"
    correlationStatus: str = "UNASSIGNED"

    # Correlated Employee Details (flattened + nested for UI compatibility)
    full_name: Optional[str] = None
    fullName: Optional[str] = None
    employee_name: Optional[str] = None
    employeeName: Optional[str] = None
    employee_user_id: Optional[str] = None
    email_work: Optional[str] = None
    emailWork: Optional[str] = None
    department: Optional[str] = None
    division: Optional[str] = None
    job_title: Optional[str] = None
    jobTitle: Optional[str] = None
    employee_status: Optional[str] = None
    employeeStatus: Optional[str] = None
    manager_name: Optional[str] = None
    managerName: Optional[str] = None
    manager_user_name: Optional[str] = None
    managerUserName: Optional[str] = None
    location: Optional[str] = None
    matched_employee: Optional[EmployeeSummary] = None
    correlated_employee: Optional[EmployeeSummary] = None
    employee: Optional[EmployeeSummary] = None

    # Audit Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases_and_mappings(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # 1. Sync Asset ID
            aid = data.get("asset_id", data.get("assetId"))
            if aid is not None:
                data["asset_id"] = aid
                data["assetId"] = aid
                data["AssetID"] = aid

            num = data.get("asset_number", data.get("assetNumber"))
            if num is not None:
                data["asset_number"] = num
                data["assetNumber"] = num

            sn = data.get("serial_number", data.get("serialNumber"))
            if sn is not None:
                data["serial_number"] = sn
                data["serialNumber"] = sn

            osn = data.get("os_name", data.get("osName"))
            if osn is not None:
                data["os_name"] = osn
                data["osName"] = osn

            # 2. Sync Device Type (devicetype -> deviceType -> DeviceType)
            dtype = data.get("devicetype") or data.get("deviceType") or data.get("DeviceType")
            data["devicetype"] = dtype
            data["deviceType"] = dtype
            data["DeviceType"] = dtype

            # 3. Sync MAC Address (macaddress -> macAddress)
            mac = data.get("macaddress") or data.get("macAddress")
            data["macaddress"] = mac
            data["macAddress"] = mac

            # 4. Sync Discovery Date (lastreporttime -> lastDiscoveryDate -> LastDiscoveryDate)
            lrt = (
                data.get("lastreporttime")
                or data.get("lastReportTime")
                or data.get("last_discovery_date")
                or data.get("lastDiscoveryDate")
                or data.get("LastDiscoveryDate")
            )
            data["lastreporttime"] = lrt
            data["lastReportTime"] = lrt
            data["last_discovery_date"] = lrt
            data["lastDiscoveryDate"] = lrt
            data["LastDiscoveryDate"] = lrt

            # 5. Sync Asset & Assignment Status
            astatus = data.get("asset_status") or data.get("assetStatus")
            data["asset_status"] = astatus
            data["assetStatus"] = astatus

            atype = data.get("assignment_type") or data.get("assignmentType")
            data["assignment_type"] = atype
            data["assignmentType"] = atype

            mb = data.get("managed_by") or data.get("managedBy")
            data["managed_by"] = mb
            data["managedBy"] = mb

            # 6. Sync EOL Status & Dates
            edate = data.get("eol_date") or data.get("eolDate")
            data["eol_date"] = edate
            data["eolDate"] = edate

            drem = data.get("days_remaining") if data.get("days_remaining") is not None else data.get("daysRemaining")
            data["days_remaining"] = drem
            data["daysRemaining"] = drem

            estatus = data.get("eol_status") or data.get("eolStatus") or "Unknown"
            data["eol_status"] = estatus
            data["eolStatus"] = estatus

            ref_src = data.get("reference_source") or data.get("referenceSource")
            data["reference_source"] = ref_src
            data["referenceSource"] = ref_src

            # Sync eol_info / eolInfo
            einfo = data.get("eol_info") or data.get("eolInfo")
            if einfo:
                data["eol_info"] = einfo
                data["eolInfo"] = einfo

            # 7. Sync Workday Ownership & Status
            user = data.get("assigned_username") or data.get("assignedUsername")
            data["assigned_username"] = user
            data["assignedUsername"] = user

            wstatus = data.get("workday_status") or data.get("workdayStatus") or "No assigned username"
            data["workday_status"] = wstatus
            data["workdayStatus"] = wstatus

            ostatus = data.get("ownership_status") or data.get("ownershipStatus") or data.get("correlation_status") or "UNASSIGNED"
            data["ownership_status"] = ostatus
            data["ownershipStatus"] = ostatus
            data["correlation_status"] = ostatus
            data["correlationStatus"] = ostatus

            # Sync Employee details
            fname = data.get("full_name") or data.get("fullName") or data.get("employee_name") or data.get("employeeName")
            data["full_name"] = fname
            data["fullName"] = fname
            data["employee_name"] = fname
            data["employeeName"] = fname

            ew = data.get("email_work") or data.get("emailWork")
            data["email_work"] = ew
            data["emailWork"] = ew

            jt = data.get("job_title") or data.get("jobTitle")
            data["job_title"] = jt
            data["jobTitle"] = jt

            es = data.get("employee_status") or data.get("employeeStatus")
            data["employee_status"] = es
            data["employeeStatus"] = es

            mn = data.get("manager_name") or data.get("managerName")
            data["manager_name"] = mn
            data["managerName"] = mn

            mun = data.get("manager_user_name") or data.get("managerUserName")
            data["manager_user_name"] = mun
            data["managerUserName"] = mun

            # Sync employee nested object
            emp = data.get("matched_employee") or data.get("correlated_employee") or data.get("employee")
            if emp:
                data["matched_employee"] = emp
                data["correlated_employee"] = emp
                data["employee"] = emp

        return data


class AssetDetailResponse(AssetResponse):
    """
    Detailed Asset record including deep correlated Workday employee profile
    and computed EOL references.
    """
    pass

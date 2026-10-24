from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class DashboardSummaryResponse(BaseModel):
    """
    Fleet Summary KPI metrics for All Assets, Windows, Mac, and Ownership pages.
    Calculated via direct PostgreSQL database aggregation.
    Guarantees non-null integer values for all 5 requested KPI metrics and all legacy aliases.
    """
    # Primary Fleet Summary 5 KPI cards
    totalAssets: int = Field(0, ge=0, description="Total number of assets in current scope")
    active: int = Field(0, ge=0, description="Count of assets with asset_status = 'Active'")
    needValidation: int = Field(0, ge=0, description="Count of assets with asset_status = 'REVIEW' / 'Need Validation'")
    review: int = Field(0, ge=0, description="Count of assets with asset_status = 'REVIEW'")
    inStock: int = Field(0, ge=0, description="Count of assets with asset_status = 'InStock'")
    nearingEol: int = Field(0, ge=0, description="Count of assets whose calculated EOL status is EOL SOON / Nearing EOL")
    eolSoon: int = Field(0, ge=0, description="Count of assets with EOL status = 'EOL SOON'")

    # CamelCase & Case variations to ensure zero empty/undefined values across any frontend card
    InStock: int = Field(0, ge=0)
    in_stock: int = Field(0, ge=0)
    nearing_eol: int = Field(0, ge=0)
    nearingEOL: int = Field(0, ge=0)
    NearingEol: int = Field(0, ge=0)
    NearingEOL: int = Field(0, ge=0)
    nearingEolAssets: int = Field(0, ge=0)
    eol_soon: int = Field(0, ge=0)
    eol_soon_assets: int = Field(0, ge=0)
    EolSoon: int = Field(0, ge=0)

    # Standard snake_case and previous field aliases
    total_assets: int = Field(0, ge=0)
    total: int = Field(0, ge=0)
    active_assets: int = Field(0, ge=0)
    activeAssets: int = Field(0, ge=0)
    need_validation_assets: int = Field(0, ge=0)
    needValidationAssets: int = Field(0, ge=0)
    review_assets: int = Field(0, ge=0)
    reviewAssets: int = Field(0, ge=0)
    in_stock_assets: int = Field(0, ge=0)
    inStockAssets: int = Field(0, ge=0)

    # Discovery Source counts
    bigfix_assets: int = Field(0, ge=0)
    bigfixAssets: int = Field(0, ge=0)
    bigfix: int = Field(0, ge=0)
    jamf_assets: int = Field(0, ge=0)
    jamfAssets: int = Field(0, ge=0)
    jamf: int = Field(0, ge=0)

    # Ownership Allocation counts
    automatically_assigned: int = Field(0, ge=0)
    automaticallyAssigned: int = Field(0, ge=0)
    autoAssigned: int = Field(0, ge=0)
    manually_assigned: int = Field(0, ge=0)
    manuallyAssigned: int = Field(0, ge=0)
    manualAssigned: int = Field(0, ge=0)
    unassigned_assets: int = Field(0, ge=0)
    unassignedAssets: int = Field(0, ge=0)
    unassigned: int = Field(0, ge=0)

    # Workforce counts
    employee_count: int = Field(0, ge=0)
    employeeCount: int = Field(0, ge=0)
    totalEmployees: int = Field(0, ge=0)

    # Six Reports Page Card Counts
    master_hardware: int = Field(0, ge=0)
    masterHardware: int = Field(0, ge=0)
    master_hardware_count: int = Field(0, ge=0)
    masterHardwareCount: int = Field(0, ge=0)

    warranty_compliance_issues: int = Field(0, ge=0)
    warrantyComplianceIssues: int = Field(0, ge=0)
    warranty_compliance: int = Field(0, ge=0)
    warrantyCompliance: int = Field(0, ge=0)
    warranty_compliance_count: int = Field(0, ge=0)
    warrantyComplianceCount: int = Field(0, ge=0)
    expired_count: int = Field(0, ge=0)
    expired_assets: int = Field(0, ge=0)

    in_stock_inventory: int = Field(0, ge=0)
    inStockInventory: int = Field(0, ge=0)
    in_stock_inventory_count: int = Field(0, ge=0)

    reports_summary: Optional[Dict[str, int]] = None
    reportsSummary: Optional[Dict[str, int]] = None
    report_counts: Optional[Dict[str, int]] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # 1. Total Assets
            tot = data.get("totalAssets", data.get("total_assets", data.get("total", 0))) or 0
            data["totalAssets"] = tot
            data["total_assets"] = tot
            data["total"] = tot

            # 2. Active Assets
            act = data.get("active", data.get("activeAssets", data.get("active_assets", 0))) or 0
            data["active"] = act
            data["activeAssets"] = act
            data["active_assets"] = act

            # 3. Need Validation / Review Assets
            nv = (
                data.get("review")
                if data.get("review") is not None
                else data.get(
                    "needValidation",
                    data.get(
                        "need_validation_assets",
                        data.get("needValidationAssets", data.get("review_assets", data.get("reviewAssets", 0))),
                    ),
                )
            ) or 0
            data["needValidation"] = nv
            data["review"] = nv
            data["need_validation_assets"] = nv
            data["needValidationAssets"] = nv
            data["review_assets"] = nv
            data["reviewAssets"] = nv

            # 4. In Stock Assets
            ins = (
                data.get("inStock")
                if data.get("inStock") is not None
                else data.get("InStock", data.get("in_stock_assets", data.get("inStockAssets", 0)))
            ) or 0
            data["inStock"] = ins
            data["InStock"] = ins
            data["in_stock"] = ins
            data["in_stock_assets"] = ins
            data["inStockAssets"] = ins

            # 5. EOL Soon / Nearing EOL Assets
            neol = (
                data.get("eolSoon")
                if data.get("eolSoon") is not None
                else data.get(
                    "eol_soon",
                    data.get(
                        "EolSoon",
                        data.get(
                            "nearingEol",
                            data.get(
                                "nearing_eol",
                                data.get(
                                    "nearingEOL",
                                    data.get(
                                        "NearingEol",
                                        data.get("NearingEOL", data.get("nearingEolAssets", 0)),
                                    ),
                                ),
                            ),
                        ),
                    ),
                )
            ) or 0
            data["nearingEol"] = neol
            data["eolSoon"] = neol
            data["eol_soon"] = neol
            data["EolSoon"] = neol
            data["eol_soon_assets"] = neol
            data["nearing_eol"] = neol
            data["nearingEOL"] = neol
            data["NearingEol"] = neol
            data["NearingEOL"] = neol
            data["nearingEolAssets"] = neol

            # Discovery counts
            bf = data.get("bigfix_assets", data.get("bigfixAssets", data.get("bigfix", 0))) or 0
            data["bigfix_assets"] = bf
            data["bigfixAssets"] = bf
            data["bigfix"] = bf

            jf = data.get("jamf_assets", data.get("jamfAssets", data.get("jamf", 0))) or 0
            data["jamf_assets"] = jf
            data["jamfAssets"] = jf
            data["jamf"] = jf

            # Assignment counts
            auto = data.get("automatically_assigned", data.get("automaticallyAssigned", data.get("autoAssigned", 0))) or 0
            data["automatically_assigned"] = auto
            data["automaticallyAssigned"] = auto
            data["autoAssigned"] = auto

            man = data.get("manually_assigned", data.get("manuallyAssigned", data.get("manualAssigned", 0))) or 0
            data["manually_assigned"] = man
            data["manuallyAssigned"] = man
            data["manualAssigned"] = man

            unass = data.get("unassigned_assets", data.get("unassignedAssets", data.get("unassigned", 0))) or 0
            data["unassigned_assets"] = unass
            data["unassignedAssets"] = unass
            data["unassigned"] = unass

            # Employee counts
            emp = data.get("employee_count", data.get("employeeCount", data.get("totalEmployees", 0))) or 0
            data["employee_count"] = emp
            data["employeeCount"] = emp
            data["totalEmployees"] = emp

            # Reports Page 6 Cards
            tot_assets = data.get("total_assets", 0)
            data["master_hardware"] = tot_assets
            data["masterHardware"] = tot_assets
            data["master_hardware_count"] = tot_assets
            data["masterHardwareCount"] = tot_assets

            warr = data.get(
                "warranty_compliance_issues",
                data.get(
                    "warrantyComplianceIssues",
                    data.get(
                        "warranty_compliance_count",
                        data.get(
                            "warrantyComplianceCount",
                            data.get("warranty_compliance", data.get("warrantyCompliance", 0)),
                        ),
                    ),
                ),
            ) or 0
            data["warranty_compliance_issues"] = warr
            data["warrantyComplianceIssues"] = warr
            data["warranty_compliance"] = warr
            data["warrantyCompliance"] = warr
            data["warranty_compliance_count"] = warr
            data["warrantyComplianceCount"] = warr

            ins = data.get("in_stock_assets", data.get("inStock", 0)) or 0
            data["in_stock_inventory"] = ins
            data["inStockInventory"] = ins
            data["in_stock_inventory_count"] = ins

            nv = data.get("need_validation_assets", data.get("needValidation", 0)) or 0
            data["need_validation_assets"] = nv
            data["needValidationAssets"] = nv
            data["need_validation_count"] = nv

            reports_dict = {
                "master_hardware": tot_assets,
                "warranty_compliance_issues": warr,
                "bigfix_assets": bf,
                "jamf_assets": jf,
                "in_stock_inventory": ins,
                "need_validation_assets": nv,
            }
            data["reports_summary"] = reports_dict
            data["reportsSummary"] = reports_dict
            data["report_counts"] = reports_dict

        return data


class SourceSummaryItem(BaseModel):
    source: str
    count: int = 0


class AssetsBySourceResponse(BaseModel):
    """
    Breakdown of assets across discovery agent sources.
    """
    bigfix_count: int = Field(0, ge=0)
    jamf_count: int = Field(0, ge=0)
    other_count: int = Field(0, ge=0)
    total_count: int = Field(0, ge=0)

    # Aliases
    bigfixCount: Optional[int] = None
    jamfCount: Optional[int] = None
    otherCount: Optional[int] = None
    totalCount: Optional[int] = None

    # Array and map representations for frontend chart compatibility
    sources: Optional[List[SourceSummaryItem]] = None
    items: Optional[List[SourceSummaryItem]] = None
    data: Optional[List[SourceSummaryItem]] = None
    by_source: Optional[Dict[str, int]] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            bf = data.get("bigfix_count", data.get("bigfixCount", 0)) or 0
            data["bigfix_count"] = bf
            data["bigfixCount"] = bf

            jf = data.get("jamf_count", data.get("jamfCount", 0)) or 0
            data["jamf_count"] = jf
            data["jamfCount"] = jf

            oth = data.get("other_count", data.get("otherCount", 0)) or 0
            data["other_count"] = oth
            data["otherCount"] = oth

            tot = data.get("total_count", data.get("totalCount", bf + jf + oth))
            if tot is None:
                tot = bf + jf + oth
            data["total_count"] = tot
            data["totalCount"] = tot

            src_items = [
                {"source": "BIGFIX", "count": bf},
                {"source": "JAMF", "count": jf},
                {"source": "OTHER", "count": oth},
            ]
            data["sources"] = src_items
            data["items"] = src_items
            data["data"] = src_items
            data["by_source"] = {
                "BIGFIX": bf,
                "JAMF": jf,
                "OTHER": oth,
            }
        return data


class OwnershipSummaryResponse(BaseModel):
    """
    Breakdown of asset ownership and assignment models.
    """
    auto_count: int = Field(0, ge=0, description="Assigned via automated telemetry")
    manual_count: int = Field(0, ge=0, description="Assigned via manual allocation")
    unassigned_count: int = Field(0, ge=0, description="No assigned username")
    other_assigned_count: int = Field(0, ge=0, description="Has username but assignment_type not AUTO or MANUAL")
    total_count: int = Field(0, ge=0)

    # Aliases
    autoCount: Optional[int] = None
    manualCount: Optional[int] = None
    unassignedCount: Optional[int] = None
    otherAssignedCount: Optional[int] = None
    totalCount: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            auto = data.get("auto_count", data.get("autoCount", 0)) or 0
            data["auto_count"] = auto
            data["autoCount"] = auto

            man = data.get("manual_count", data.get("manualCount", 0)) or 0
            data["manual_count"] = man
            data["manualCount"] = man

            unass = data.get("unassigned_count", data.get("unassignedCount", 0)) or 0
            data["unassigned_count"] = unass
            data["unassignedCount"] = unass

            oth = data.get("other_assigned_count", data.get("otherAssignedCount", 0)) or 0
            data["other_assigned_count"] = oth
            data["otherAssignedCount"] = oth

            tot = data.get("total_count", data.get("totalCount", 0)) or 0
            data["total_count"] = tot
            data["totalCount"] = tot
        return data


class DepartmentSummaryItem(BaseModel):
    """
    Department-level hardware inventory summary.
    Includes department label, total assets, status distribution, agent breakdown, and divisions.
    """
    department: str = Field(..., description="Department name or 'Unassigned'")
    asset_count: int = Field(0, ge=0, description="Total assets assigned to this department")
    total_assets: int = Field(0, ge=0, description="Total assets assigned to this department")
    active: int = Field(0, ge=0, description="Count of active assets")
    active_assets: int = Field(0, ge=0, description="Count of active assets")
    need_validation: int = Field(0, ge=0, description="Count of need validation assets")
    need_validation_assets: int = Field(0, ge=0, description="Count of need validation assets")
    review: int = Field(0, ge=0, description="Count of review assets")
    review_assets: int = Field(0, ge=0, description="Count of review assets")
    in_stock: int = Field(0, ge=0, description="Count of in-stock assets")
    in_stock_assets: int = Field(0, ge=0, description="Count of in-stock assets")
    bigfix: int = Field(0, ge=0, description="Count of BigFix assets")
    bigfix_assets: int = Field(0, ge=0, description="Count of BigFix assets")
    jamf: int = Field(0, ge=0, description="Count of Jamf assets")
    jamf_assets: int = Field(0, ge=0, description="Count of Jamf assets")
    divisions: List[str] = Field(default_factory=list, description="Divisions associated with this department")

    # CamelCase & convenience aliases for all frontend card/chart variations
    department_name: Optional[str] = None
    departmentName: Optional[str] = None
    count: Optional[int] = None
    total: Optional[int] = None
    totalAssets: Optional[int] = None
    needValidation: Optional[int] = None
    reviewAssets: Optional[int] = None
    inStock: Optional[int] = None
    bigfix_count: Optional[int] = None
    jamf_count: Optional[int] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            dept = data.get("department", data.get("department_name", data.get("departmentName", "Unassigned"))) or "Unassigned"
            dept_str = str(dept).strip() if str(dept).strip() else "Unassigned"
            data["department"] = dept_str
            data["department_name"] = dept_str
            data["departmentName"] = dept_str

            tot = data.get("total_assets", data.get("totalAssets", data.get("asset_count", data.get("count", data.get("total", 0))))) or 0
            data["total_assets"] = tot
            data["totalAssets"] = tot
            data["asset_count"] = tot
            data["count"] = tot
            data["total"] = tot

            act = data.get("active_assets", data.get("active", 0)) or 0
            data["active_assets"] = act
            data["active"] = act

            nv = data.get(
                "review",
                data.get(
                    "review_assets",
                    data.get("need_validation_assets", data.get("needValidation", data.get("need_validation", 0))),
                ),
            ) or 0
            data["need_validation_assets"] = nv
            data["needValidation"] = nv
            data["need_validation"] = nv
            data["review"] = nv
            data["review_assets"] = nv
            data["reviewAssets"] = nv

            ins = data.get("in_stock_assets", data.get("inStock", data.get("in_stock", 0))) or 0
            data["in_stock_assets"] = ins
            data["inStock"] = ins
            data["in_stock"] = ins

            bf = data.get("bigfix_assets", data.get("bigfix", data.get("bigfix_count", 0))) or 0
            data["bigfix_assets"] = bf
            data["bigfix"] = bf
            data["bigfix_count"] = bf

            jf = data.get("jamf_assets", data.get("jamf", data.get("jamf_count", 0))) or 0
            data["jamf_assets"] = jf
            data["jamf"] = jf
            data["jamf_count"] = jf

            divs = data.get("divisions", [])
            data["divisions"] = sorted(list(set(str(d).strip() for d in divs if d and str(d).strip())))
        return data


class DepartmentSummaryResponse(BaseModel):
    """
    Fleet-wide department summary response envelope.
    Provides collection items, aggregated totals, and convenient lookup dictionaries.
    """
    items: List[DepartmentSummaryItem] = Field(default_factory=list)
    total_departments: int = Field(0, ge=0)
    total_assets: int = Field(0, ge=0)

    # Aliases for frontend flexibility
    departments: Optional[List[DepartmentSummaryItem]] = None
    data: Optional[List[DepartmentSummaryItem]] = None
    totalDepartments: Optional[int] = None
    totalAssets: Optional[int] = None
    summary: Optional[Dict[str, int]] = None
    by_department: Optional[Dict[str, int]] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_items = data.get("items", data.get("departments", data.get("data", []))) or []
            data["items"] = raw_items
            data["departments"] = raw_items
            data["data"] = raw_items

            tot_dept = data.get("total_departments", data.get("totalDepartments", len(raw_items)))
            data["total_departments"] = tot_dept
            data["totalDepartments"] = tot_dept

            tot_assets = data.get("total_assets", data.get("totalAssets"))
            if tot_assets is None:
                tot_assets = sum(
                    getattr(it, "total_assets", it.get("total_assets", 0) if isinstance(it, dict) else 0)
                    for it in raw_items
                )
            data["total_assets"] = tot_assets
            data["totalAssets"] = tot_assets

            sum_map: Dict[str, int] = {}
            for it in raw_items:
                d_name = getattr(it, "department", it.get("department") if isinstance(it, dict) else "Unassigned")
                d_cnt = getattr(it, "total_assets", it.get("total_assets", 0) if isinstance(it, dict) else 0)
                sum_map[d_name] = d_cnt
            data["summary"] = sum_map
            data["by_department"] = sum_map
        return data


class OperationalStatusItem(BaseModel):
    status: str
    count: int = 0


class OperationalStatusResponse(BaseModel):
    """
    Fleet operational status breakdown based on assets.asset_status.
    Known categories: Active, Need Validation, InStock.
    """
    active: int = Field(0, ge=0, description="Count of assets with asset_status = 'Active'")
    needValidation: int = Field(0, ge=0, description="Count of assets with asset_status = 'Need Validation'")
    review: int = Field(0, ge=0, description="Count of assets with asset_status = 'REVIEW'")
    inStock: int = Field(0, ge=0, description="Count of assets with asset_status = 'InStock'")
    total: int = Field(0, ge=0, description="Total assets evaluated")

    # Array and map representations for universal frontend compatibility
    items: Optional[List[OperationalStatusItem]] = None
    data: Optional[Dict[str, int]] = None

    # Snake_case & legacy card aliases
    active_count: Optional[int] = None
    activeAssets: Optional[int] = None
    active_assets: Optional[int] = None

    need_validation_count: Optional[int] = None
    needValidationAssets: Optional[int] = None
    need_validation_assets: Optional[int] = None
    need_validation: Optional[int] = None
    review_count: Optional[int] = None
    reviewAssets: Optional[int] = None
    review_assets: Optional[int] = None

    in_stock_count: Optional[int] = None
    inStockAssets: Optional[int] = None
    in_stock_assets: Optional[int] = None
    in_stock: Optional[int] = None
    InStock: Optional[int] = None

    total_count: Optional[int] = None
    total_assets: Optional[int] = None
    totalAssets: Optional[int] = None

    # Status breakdown dictionary mapping status label -> count
    by_status: Optional[Dict[str, int]] = None
    status_counts: Optional[Dict[str, int]] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            act = data.get("active", data.get("active_count", data.get("activeAssets", data.get("active_assets", 0)))) or 0
            data["active"] = act
            data["active_count"] = act
            data["activeAssets"] = act
            data["active_assets"] = act

            nv = data.get(
                "review",
                data.get(
                    "review_count",
                    data.get(
                        "review_assets",
                        data.get(
                            "needValidation",
                            data.get(
                                "need_validation_count",
                                data.get("need_validation", data.get("needValidationAssets", data.get("need_validation_assets", 0))),
                            ),
                        ),
                    ),
                ),
            ) or 0
            data["needValidation"] = nv
            data["need_validation"] = nv
            data["need_validation_count"] = nv
            data["needValidationAssets"] = nv
            data["need_validation_assets"] = nv
            data["review"] = nv
            data["review_count"] = nv
            data["review_assets"] = nv
            data["reviewAssets"] = nv

            ins = data.get("inStock", data.get("InStock", data.get("in_stock", data.get("in_stock_count", data.get("inStockAssets", data.get("in_stock_assets", 0)))))) or 0
            data["inStock"] = ins
            data["InStock"] = ins
            data["in_stock"] = ins
            data["in_stock_count"] = ins
            data["inStockAssets"] = ins
            data["in_stock_assets"] = ins

            tot = data.get("total", data.get("total_count", data.get("total_assets", data.get("totalAssets", None))))
            if tot is None:
                tot = act + nv + ins
            data["total"] = tot
            data["total_count"] = tot
            data["total_assets"] = tot
            data["totalAssets"] = tot

            mapping = {
                "Active": act,
                "Need Validation": nv,
                "Review": nv,
                "REVIEW": nv,
                "InStock": ins,
            }
            data["by_status"] = mapping
            data["status_counts"] = mapping
            data["data"] = {
                "active": act,
                "needValidation": nv,
                "review": nv,
                "inStock": ins,
            }
            data["items"] = [
                {"status": "Active", "count": act},
                {"status": "Need Validation", "count": nv},
                {"status": "Review", "count": nv},
                {"status": "InStock", "count": ins},
            ]
        return data


class OperatingSystemItem(BaseModel):
    name: str = Field(..., description="Operating system name")
    count: int = Field(0, ge=0, description="Number of assets running this OS")
    percentage: Optional[float] = Field(None, description="Percentage of assets with valid OS")

    # Aliases
    label: Optional[str] = None
    os_name: Optional[str] = None
    operating_system: Optional[str] = None
    share: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            name = data.get("name") or data.get("os_name") or data.get("operating_system") or data.get("label") or ""
            data["name"] = name
            data["label"] = name
            data["os_name"] = name
            data["operating_system"] = name
            if "percentage" in data and data["percentage"] is not None and "share" not in data:
                data["share"] = data["percentage"]
            elif "share" in data and data["share"] is not None and "percentage" not in data:
                data["percentage"] = data["share"]
        return data


class DeviceTypeItem(BaseModel):
    name: str = Field(..., description="Device type (e.g. Desktop, Server)")
    count: int = Field(0, ge=0, description="Number of assets of this device type")
    percentage: Optional[float] = Field(None, description="Percentage of assets with valid device type")

    # Aliases
    label: Optional[str] = None
    devicetype: Optional[str] = None
    device_type: Optional[str] = None
    share: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            name = data.get("name") or data.get("devicetype") or data.get("device_type") or data.get("label") or ""
            data["name"] = name
            data["label"] = name
            data["devicetype"] = name
            data["device_type"] = name
            if "percentage" in data and data["percentage"] is not None and "share" not in data:
                data["share"] = data["percentage"]
            elif "share" in data and data["share"] is not None and "percentage" not in data:
                data["percentage"] = data["share"]
        return data


class DeviceTypeCategoryItem(BaseModel):
    category: str = Field(..., description="STORE or CORPORATE")
    deviceType: str = Field(..., description="Laptop or Desktop")
    label: str = Field(..., description="STORE-DESKTOPS, CORPORATE-LAPTOPS, or CORPORATE-DESKTOPS")
    count: int = Field(0, ge=0)

    # Aliases
    device_type: Optional[str] = None
    devicetype: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            dev = data.get("deviceType") or data.get("device_type") or data.get("devicetype") or ""
            data["deviceType"] = dev
            data["device_type"] = dev
            data["devicetype"] = dev
        return data


class DeviceTypeCategoryResponse(BaseModel):
    byDeviceTypeAndCategory: List[DeviceTypeCategoryItem] = Field(default_factory=list)
    by_device_type_and_category: Optional[List[DeviceTypeCategoryItem]] = None
    items: Optional[List[DeviceTypeCategoryItem]] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            items = (
                data.get("byDeviceTypeAndCategory")
                or data.get("by_device_type_and_category")
                or data.get("items")
                or []
            )
            data["byDeviceTypeAndCategory"] = items
            data["by_device_type_and_category"] = items
            data["items"] = items
        return data


class CategoryItem(BaseModel):
    name: str = Field(..., description="Category (e.g. STORE, CORPORATE)")
    count: int = Field(0, ge=0, description="Number of assets in this category")
    percentage: Optional[float] = Field(None, description="Percentage of assets with valid category")

    # Aliases
    label: Optional[str] = None
    category: Optional[str] = None
    share: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            name = data.get("name") or data.get("category") or data.get("label") or ""
            data["name"] = name
            data["label"] = name
            data["category"] = name
            if "percentage" in data and data["percentage"] is not None and "share" not in data:
                data["share"] = data["percentage"]
            elif "share" in data and data["share"] is not None and "percentage" not in data:
                data["percentage"] = data["share"]
        return data


class HardwareAssetAnalysisResponse(BaseModel):
    """
    Live aggregated hardware asset analysis for dashboard doughnut charts:
    1. Assets by Operating System (Windows 11, Windows 10, Mac)
    2. Assets by Device Type (Laptops, Desktops)
    3. Assets by Category (STORE, CORPORATE)
    """
    operating_systems: List[OperatingSystemItem] = Field(default_factory=list, description="Assets grouped by Operating System")
    device_types: List[DeviceTypeItem] = Field(default_factory=list, description="Assets grouped by Device Type")
    categories: List[CategoryItem] = Field(default_factory=list, description="Assets grouped by Category (STORE, CORPORATE)")

    total_assets: int = Field(0, ge=0, description="Total assets in evaluation scope")
    total_os_assets: int = Field(0, ge=0, description="Total assets with a non-empty OS")
    total_device_assets: int = Field(0, ge=0, description="Total assets with a non-empty device type")
    total_category_assets: int = Field(0, ge=0, description="Total assets with a valid category")

    # CamelCase aliases
    operatingSystems: Optional[List[OperatingSystemItem]] = None
    deviceTypes: Optional[List[DeviceTypeItem]] = None
    byOperatingSystem: Optional[List[OperatingSystemItem]] = None
    by_operating_system: Optional[List[OperatingSystemItem]] = None
    byDeviceType: Optional[List[DeviceTypeItem]] = None
    by_device_type: Optional[List[DeviceTypeItem]] = None
    byCategories: Optional[List[CategoryItem]] = None
    by_categories: Optional[List[CategoryItem]] = None
    totalAssets: Optional[int] = None
    totalOsAssets: Optional[int] = None
    totalDeviceAssets: Optional[int] = None
    totalCategoryAssets: Optional[int] = None

    # Map/Dict representations for charts that accept label -> count dictionaries
    by_os: Optional[Dict[str, int]] = None
    byOs: Optional[Dict[str, int]] = None
    by_device: Optional[Dict[str, int]] = None
    byDevice: Optional[Dict[str, int]] = None
    by_category: Optional[Dict[str, int]] = None
    byCategory: Optional[Dict[str, int]] = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            os_items = data.get("operating_systems", data.get("operatingSystems", data.get("by_operating_system", data.get("byOperatingSystem", [])))) or []
            data["operating_systems"] = os_items
            data["operatingSystems"] = os_items
            data["by_operating_system"] = os_items
            data["byOperatingSystem"] = os_items

            dev_items = data.get("device_types", data.get("deviceTypes", data.get("by_device_type", data.get("byDeviceType", [])))) or []
            data["device_types"] = dev_items
            data["deviceTypes"] = dev_items
            data["by_device_type"] = dev_items
            data["byDeviceType"] = dev_items

            cat_items = data.get("categories", data.get("by_categories", data.get("byCategories", []))) or []
            data["categories"] = cat_items
            data["by_categories"] = cat_items
            data["byCategories"] = cat_items

            tot = data.get("total_assets", data.get("totalAssets", 0)) or 0
            data["total_assets"] = tot
            data["totalAssets"] = tot

            tot_os = data.get("total_os_assets", data.get("totalOsAssets", sum(it.get("count", 0) if isinstance(it, dict) else getattr(it, "count", 0) for it in os_items))) or 0
            data["total_os_assets"] = tot_os
            data["totalOsAssets"] = tot_os

            tot_dev = data.get("total_device_assets", data.get("totalDeviceAssets", sum(it.get("count", 0) if isinstance(it, dict) else getattr(it, "count", 0) for it in dev_items))) or 0
            data["total_device_assets"] = tot_dev
            data["totalDeviceAssets"] = tot_dev

            tot_cat = data.get("total_category_assets", data.get("totalCategoryAssets", sum(it.get("count", 0) if isinstance(it, dict) else getattr(it, "count", 0) for it in cat_items))) or 0
            data["total_category_assets"] = tot_cat
            data["totalCategoryAssets"] = tot_cat

            os_map = {
                (it.get("name") if isinstance(it, dict) else getattr(it, "name", "")): (it.get("count") if isinstance(it, dict) else getattr(it, "count", 0))
                for it in os_items
            }
            data["by_os"] = os_map
            data["byOs"] = os_map

            dev_map = {}
            for it in dev_items:
                name = it.get("name") if isinstance(it, dict) else getattr(it, "name", "")
                cnt = it.get("count") if isinstance(it, dict) else getattr(it, "count", 0)
                dev_map[name] = cnt
                # Dual-register singular and plural for bulletproof chart lookups
                if name == "Laptops":
                    dev_map["Laptop"] = cnt
                elif name == "Laptop":
                    dev_map["Laptops"] = cnt
                elif name == "Desktops":
                    dev_map["Desktop"] = cnt
                elif name == "Desktop":
                    dev_map["Desktops"] = cnt
            data["by_device"] = dev_map
            data["byDevice"] = dev_map

            cat_map = {}
            if isinstance(data.get("by_category"), dict):
                cat_map.update(data["by_category"])
            elif isinstance(data.get("byCategory"), dict):
                cat_map.update(data["byCategory"])
            else:
                for it in cat_items:
                    cname = it.get("name") if isinstance(it, dict) else getattr(it, "name", "")
                    ccnt = it.get("count") if isinstance(it, dict) else getattr(it, "count", 0)
                    if cname:
                        cat_map[cname] = ccnt
            data["by_category"] = cat_map
            data["byCategory"] = cat_map

        return data



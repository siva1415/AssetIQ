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

from app.schemas.common import PaginatedResponse
from app.schemas.health import HealthResponse
from app.schemas.asset import AssetResponse, AssetDetailResponse
from app.schemas.employee import EmployeeResponse, EmployeeDetailResponse, EmployeeSummary, AssignedAssetSummary
from app.schemas.eol import EolInfo, EolAssetItem, EolSummaryResponse
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    AssetsBySourceResponse,
    SourceSummaryItem,
    OwnershipSummaryResponse,
    DepartmentSummaryResponse,
    DepartmentSummaryItem,
    OperationalStatusResponse,
    OperationalStatusItem,
)
from app.schemas.filter import FilterOptionsResponse
from app.schemas.eol_reference import EolReferenceResponse, EolReferenceCreate, EolReferenceUpdate
from app.schemas.admin_user import AdminUserResponse, AdminUserCreateRequest, AdminUserCreateItem

__all__ = [
    "PaginatedResponse",
    "HealthResponse",
    "AssetResponse",
    "AssetDetailResponse",
    "EmployeeResponse",
    "EmployeeDetailResponse",
    "EmployeeSummary",
    "AssignedAssetSummary",
    "EolInfo",
    "EolAssetItem",
    "EolSummaryResponse",
    "DashboardSummaryResponse",
    "AssetsBySourceResponse",
    "SourceSummaryItem",
    "OwnershipSummaryResponse",
    "DepartmentSummaryResponse",
    "DepartmentSummaryItem",
    "OperationalStatusResponse",
    "OperationalStatusItem",
    "FilterOptionsResponse",
    "EolReferenceResponse",
    "EolReferenceCreate",
    "EolReferenceUpdate",
    "AdminUserResponse",
    "AdminUserCreateRequest",
    "AdminUserCreateItem",
]

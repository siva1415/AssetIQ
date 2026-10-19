from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    dashboard,
    assets,
    employees,
    eol,
    filters,
    eol_reference,
    admin_users,
)

api_router = APIRouter()

# API v1 routes mounted under /api
api_router.include_router(dashboard.router)
api_router.include_router(assets.router)
api_router.include_router(employees.router)
api_router.include_router(eol.router)
api_router.include_router(eol_reference.router)
api_router.include_router(admin_users.router)
api_router.include_router(filters.router)

# Top-level assignment aliases for frontend flexibility
api_router.add_api_route("/assign", assets.assign_asset_payload, methods=["POST", "PUT"], include_in_schema=False)
api_router.add_api_route("/reassign", assets.assign_asset_payload, methods=["POST", "PUT"], include_in_schema=False)
api_router.add_api_route("/assignment", assets.assign_asset_payload, methods=["POST", "PUT"], include_in_schema=False)
api_router.add_api_route("/assignments", assets.assign_asset_payload, methods=["POST", "PUT"], include_in_schema=False)
api_router.add_api_route("/bulk-assign", assets.bulk_assign_assets, methods=["POST", "PUT"], include_in_schema=False)
api_router.add_api_route("/bulk-assignment", assets.bulk_assign_assets, methods=["POST", "PUT"], include_in_schema=False)

# Top-level reports summary aliases
api_router.add_api_route("/reports/summary", dashboard.get_reports_summary, methods=["GET"], include_in_schema=False)
api_router.add_api_route("/reports/counts", dashboard.get_reports_summary, methods=["GET"], include_in_schema=False)
api_router.add_api_route("/reports-summary", dashboard.get_reports_summary, methods=["GET"], include_in_schema=False)

# Top-level hardware asset analysis aliases
api_router.add_api_route("/hardware-analysis", dashboard.get_hardware_asset_analysis, methods=["GET"], include_in_schema=False)
api_router.add_api_route("/hardware-asset-analysis", dashboard.get_hardware_asset_analysis, methods=["GET"], include_in_schema=False)
api_router.add_api_route("/assets-by-os", dashboard.get_assets_by_operating_system, methods=["GET"], include_in_schema=False)
api_router.add_api_route("/assets-by-device-type", dashboard.get_assets_by_device_type, methods=["GET"], include_in_schema=False)


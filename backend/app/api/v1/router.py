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

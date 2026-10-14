from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.db.session import check_database_connection
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application & Database Connectivity Health Status",
)
def get_health(response: Response):
    """
    Check the running status of the FastAPI backend and test connectivity
    to the PostgreSQL database.
    """
    is_connected, db_message = check_database_connection()

    if is_connected:
        health_status = "healthy"
        db_status = "connected"
    else:
        health_status = "degraded"
        db_status = "disconnected"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status=health_status,
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        database_status=db_status,
        database_message=db_message,
        timestamp=datetime.now(timezone.utc),
    )

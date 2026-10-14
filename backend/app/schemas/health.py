from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """
    Health check status response payload.
    """
    status: str = Field(..., description="Overall status: healthy or degraded")
    app_name: str
    environment: str
    database_status: str = Field(..., description="connected or disconnected")
    database_message: str
    timestamp: datetime

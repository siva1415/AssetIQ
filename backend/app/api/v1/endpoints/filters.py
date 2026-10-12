from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_database
from app.schemas.filter import FilterOptionsResponse
from app.services.filter_service import FilterService

router = APIRouter(prefix="/filters", tags=["Filters"])


@router.get(
    "",
    response_model=FilterOptionsResponse,
    summary="Available Filter Values for Assets & Employees",
)
def get_filters(db: Session = Depends(get_database)):
    """
    Retrieve dynamically populated distinct filter values for sources,
    statuses, device types, departments, and manufacturers.
    """
    return FilterService.get_filter_options(db)

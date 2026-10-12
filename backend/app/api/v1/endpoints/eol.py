from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import PaginationParams, get_database
from app.schemas.common import PaginatedResponse
from app.schemas.eol import EolAssetItem
from app.services.eol_service import EolService

router = APIRouter(prefix="/eol", tags=["Lifecycle & EOL"])


@router.get(
    "",
    response_model=PaginatedResponse[EolAssetItem],
    summary="Assets with Calculated Hardware Lifecycle and EOL Status",
)
def list_eol_assets(
    pagination: PaginationParams = Depends(),
    source: Optional[str] = Query(None, description="Filter by source (BIGFIX or JAMF)"),
    asset_status: Optional[str] = Query(None, description="Filter by asset status"),
    devicetype: Optional[str] = Query(None, description="Filter by device type"),
    manufacturer: Optional[str] = Query(None, description="Filter by manufacturer"),
    model: Optional[str] = Query(None, description="Filter by model"),
    search: Optional[str] = Query(None, description="Text search on asset number, serial, model"),
    db: Session = Depends(get_database),
):
    """
    Retrieve assets correlated with reference EOL dates, calculating days remaining
    and active/nearing-eol/expired/unknown lifecycle status on the fly.
    """
    return EolService.get_paginated_eol_assets(
        db=db,
        page=pagination.page,
        page_size=pagination.page_size,
        source=source,
        asset_status=asset_status,
        devicetype=devicetype,
        manufacturer=manufacturer,
        model=model,
        search=search,
    )

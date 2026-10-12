from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_database
from app.schemas.common import PaginatedResponse
from app.schemas.eol_reference import (
    EolReferenceResponse,
    EolReferenceCreate,
    EolReferenceUpdate,
)
from app.services.eol_service import EolService

router = APIRouter(prefix="/eol-reference", tags=["EOL Reference"])


@router.get(
    "",
    response_model=Union[List[EolReferenceResponse], PaginatedResponse[EolReferenceResponse]],
    summary="List Device EOL Reference Records",
)
@router.get(
    "/",
    response_model=Union[List[EolReferenceResponse], PaginatedResponse[EolReferenceResponse]],
    include_in_schema=False,
)
def list_eol_references(
    page: Optional[int] = Query(None, description="Page number for paginated results"),
    page_size: Optional[int] = Query(None, description="Page size for paginated results"),
    paginated: bool = Query(False, description="Whether to return a paginated envelope"),
    manufacturer: Optional[str] = Query(None, description="Filter by hardware manufacturer"),
    model: Optional[str] = Query(None, description="Filter by hardware model"),
    search: Optional[str] = Query(None, description="Search manufacturer, model, or source"),
    db: Session = Depends(get_database),
):
    """
    Retrieve reference EOL dates and sources used for lifecycle calculation.
    Returns a direct list of EOL records by default (matching frontend table expectations),
    or an empty list if no records exist. Supports paginated envelope when paginated=True.
    """
    if paginated:
        page_num = page or 1
        size = page_size or 25
        responses, total_count = EolService.list_references(
            db=db,
            page=page_num,
            page_size=size,
            manufacturer=manufacturer,
            model=model,
            search=search,
        )
        total_pages = (total_count + size - 1) // size if total_count > 0 else 0
        return PaginatedResponse(
            items=responses,
            total=total_count,
            total_items=total_count,
            total_pages=total_pages,
            page=page_num,
            page_size=size,
        )

    responses, _ = EolService.list_references(
        db=db,
        page=page or 1,
        page_size=page_size,
        manufacturer=manufacturer,
        model=model,
        search=search,
    )
    return responses


@router.get(
    "/{eol_id}",
    response_model=EolReferenceResponse,
    summary="Get Single Device EOL Reference Record",
)
def get_eol_reference(
    eol_id: int,
    db: Session = Depends(get_database),
):
    """
    Retrieve a single hardware lifecycle reference record by ID.
    """
    ref = EolService.get_reference(db=db, eol_id=eol_id)
    if not ref:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EOL reference record with ID {eol_id} not found",
        )
    return ref


@router.post(
    "",
    response_model=EolReferenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Device EOL Reference Record",
)
def create_eol_reference(
    payload: EolReferenceCreate,
    db: Session = Depends(get_database),
):
    """
    Add a new OEM hardware model lifecycle record.
    """
    return EolService.create_reference(db=db, data=payload)


@router.put(
    "/{eol_id}",
    response_model=EolReferenceResponse,
    summary="Update Device EOL Reference Record",
)
def update_eol_reference(
    eol_id: int,
    payload: EolReferenceUpdate,
    db: Session = Depends(get_database),
):
    """
    Update an existing hardware lifecycle reference record.
    """
    updated = EolService.update_reference(db=db, eol_id=eol_id, data=payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EOL reference record with ID {eol_id} not found",
        )
    return updated


@router.delete(
    "/{eol_id}",
    summary="Delete Device EOL Reference Record",
)
def delete_eol_reference(
    eol_id: int,
    db: Session = Depends(get_database),
):
    """
    Remove an OEM lifecycle reference record.
    """
    deleted = EolService.delete_reference(db=db, eol_id=eol_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EOL reference record with ID {eol_id} not found",
        )
    return {"message": f"EOL reference record {eol_id} deleted successfully", "eol_id": eol_id}

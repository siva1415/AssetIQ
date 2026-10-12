from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field, model_validator

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standard envelope for paginated collections.
    Returns both `total` and `total_items`, `page`, `page_size`, and `total_pages`.
    Provides camelCase aliases and `data` alias for seamless frontend consumption.
    """
    items: List[T] = Field(default_factory=list)
    total: int = Field(default=0, ge=0, description="Total number of matching records")
    total_items: int = Field(default=0, ge=0, description="Legacy alias for total")
    total_pages: int = Field(default=0, ge=0, description="Total number of pages")
    page: int = Field(default=1, ge=1, description="Current page number")
    page_size: int = Field(default=25, ge=1, description="Number of items per page")

    # Frontend aliases
    data: Optional[List[T]] = None
    totalPages: Optional[int] = None
    pageSize: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def sync_pagination_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            items = values.get("items", [])
            if "data" not in values or values["data"] is None:
                values["data"] = items

            # Sync total and total_items
            tot = values.get("total")
            tot_items = values.get("total_items")
            final_total = tot if tot is not None else (tot_items if tot_items is not None else 0)
            values["total"] = final_total
            values["total_items"] = final_total

            # Sync page size and total pages
            page_size = values.get("page_size", values.get("pageSize", 25))
            values["page_size"] = page_size
            values["pageSize"] = page_size

            total_pages = values.get("total_pages", values.get("totalPages", 0))
            values["total_pages"] = total_pages
            values["totalPages"] = total_pages
        return values

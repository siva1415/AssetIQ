from typing import Any, Generator, Optional, Union
from fastapi import Query
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db


def get_database() -> Generator[Session, None, None]:
    """
    FastAPI dependency wrapper for the database session generator.
    """
    yield from get_db()


def _parse_int_param(val: Any, default: int) -> int:
    if val is None:
        return default
    if isinstance(val, int):
        return val
    try:
        s = str(val).strip()
        if s.lower() in ("all", "max", "-1"):
            return settings.MAX_PAGE_SIZE
        return int(s)
    except (ValueError, TypeError):
        return default


class PaginationParams:
    """
    Standard validated query parameters for paginated endpoints.
    Defensively parses page and page size, supports camelCase and SQL limit/offset aliases,
    and enforces maximum page size by capping at MAX_PAGE_SIZE rather than failing with 422.
    """
    def __init__(
        self,
        page: Optional[Union[int, str]] = Query(1, description="Page number (1-indexed)"),
        page_size: Optional[Union[int, str]] = Query(
            default=None,
            description=f"Items per page (enforced max {settings.MAX_PAGE_SIZE})",
        ),
        pageSize: Optional[Union[int, str]] = Query(
            default=None,
            include_in_schema=False,
            description="camelCase alias for page_size",
        ),
        limit: Optional[Union[int, str]] = Query(
            default=None,
            include_in_schema=False,
            description="SQL limit alias for page_size",
        ),
        offset: Optional[Union[int, str]] = Query(
            default=None,
            include_in_schema=False,
            description="SQL offset alias",
        ),
    ):
        raw_page = _parse_int_param(page, 1)
        raw_offset = _parse_int_param(offset, None) if offset is not None else None

        # Resolve page_size
        raw_size = None
        if page_size is not None:
            raw_size = _parse_int_param(page_size, settings.DEFAULT_PAGE_SIZE)
        elif pageSize is not None:
            raw_size = _parse_int_param(pageSize, settings.DEFAULT_PAGE_SIZE)
        elif limit is not None:
            raw_size = _parse_int_param(limit, settings.DEFAULT_PAGE_SIZE)
        else:
            raw_size = settings.DEFAULT_PAGE_SIZE

        if raw_size <= 0:
            raw_size = settings.DEFAULT_PAGE_SIZE

        # Enforce max page size limit (caps to MAX_PAGE_SIZE)
        if raw_size > settings.MAX_PAGE_SIZE:
            raw_size = settings.MAX_PAGE_SIZE

        # Resolve offset to 1-indexed page if offset was passed
        if raw_offset is not None and (page is None or raw_page == 1):
            raw_page = (raw_offset // raw_size) + 1 if raw_size > 0 else 1

        if raw_page < 1:
            raw_page = 1

        self.page = raw_page
        self.page_size = raw_size

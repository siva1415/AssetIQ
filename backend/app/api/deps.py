from typing import Generator
from fastapi import Query
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db


def get_database() -> Generator[Session, None, None]:
    """
    FastAPI dependency wrapper for the database session generator.
    """
    yield from get_db()


class PaginationParams:
    """
    Standard validated query parameters for paginated endpoints.
    """
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(
            default=settings.DEFAULT_PAGE_SIZE,
            ge=1,
            le=settings.MAX_PAGE_SIZE,
            description=f"Items per page (max {settings.MAX_PAGE_SIZE})",
        ),
    ):
        self.page = page
        self.page_size = page_size

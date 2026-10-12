from sqlalchemy.orm import Session
from app.repositories.eol_repository import EolRepository
from app.schemas.filter import FilterOptionsResponse


class FilterService:
    """
    Business logic for discovering available criteria filter options.
    """

    @staticmethod
    def get_filter_options(db: Session) -> FilterOptionsResponse:
        data = EolRepository.get_distinct_filter_values(db)
        return FilterOptionsResponse(
            sources=data.get("sources", []),
            asset_statuses=data.get("asset_statuses", []),
            device_types=data.get("device_types", []),
            assignment_types=data.get("assignment_types", []),
            manufacturers=data.get("manufacturers", []),
            departments=data.get("departments", []),
            divisions=data.get("divisions", []),
            employee_statuses=data.get("employee_statuses", []),
        )

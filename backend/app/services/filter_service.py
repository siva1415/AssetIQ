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
        raw_statuses = [s for s in data.get("asset_statuses", []) if s]
        statuses = list(raw_statuses)
        for s in raw_statuses:
            if not s or not isinstance(s, str):
                continue
            s_upper = s.strip().upper()
            if s_upper == "ACTIVE" and "Active" not in statuses:
                statuses.append("Active")
            elif s_upper in ("REVIEW", "NEED VALIDATION"):
                if "REVIEW" not in statuses:
                    statuses.append("REVIEW")
                if "Review" not in statuses:
                    statuses.append("Review")
                if "Need Validation" not in statuses:
                    statuses.append("Need Validation")
            elif s_upper == "IN STOCK" and "InStock" not in statuses:
                statuses.append("InStock")
        return FilterOptionsResponse(
            sources=[s for s in data.get("sources", []) if s],
            asset_statuses=[s for s in statuses if s],
            device_types=[d for d in data.get("device_types", []) if d],
            assignment_types=[a for a in data.get("assignment_types", []) if a],
            manufacturers=[m for m in data.get("manufacturers", []) if m],
            departments=[d for d in data.get("departments", []) if d],
            divisions=[d for d in data.get("divisions", []) if d],
            employee_statuses=[e for e in data.get("employee_statuses", []) if e],
        )

from typing import List
from pydantic import BaseModel


class FilterOptionsResponse(BaseModel):
    """
    Distinct available values for populating dropdown filters in UI.
    """
    sources: List[str]
    asset_statuses: List[str]
    device_types: List[str]
    assignment_types: List[str]
    manufacturers: List[str]
    departments: List[str]
    divisions: List[str]
    employee_statuses: List[str]

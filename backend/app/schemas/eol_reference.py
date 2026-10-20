from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class EolReferenceResponse(BaseModel):
    eol_id: int
    eolId: Optional[int] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    eol_date: Optional[date] = None
    eolDate: Optional[date] = None
    reference_source: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="after")
    def populate_aliases(self) -> "EolReferenceResponse":
        if self.eolId is None:
            self.eolId = self.eol_id
        if self.eolDate is None:
            self.eolDate = self.eol_date
        return self


class EolReferenceCreate(BaseModel):
    manufacturer: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    eol_date: Optional[date] = None
    eolDate: Optional[date] = None
    reference_source: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def sync_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "eol_date" not in data and "eolDate" in data:
                data["eol_date"] = data["eolDate"]
            if "reference_source" not in data and "referenceSource" in data:
                data["reference_source"] = data.get("referenceSource")
            if "referenceSource" in data:
                data.pop("referenceSource", None)
        return data


class EolReferenceUpdate(BaseModel):
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    eol_date: Optional[date] = None
    eolDate: Optional[date] = None
    reference_source: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def sync_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "eol_date" not in data and "eolDate" in data:
                data["eol_date"] = data["eolDate"]
            if "reference_source" not in data and "referenceSource" in data:
                data["reference_source"] = data.get("referenceSource")
            if "referenceSource" in data:
                data.pop("referenceSource", None)
        return data

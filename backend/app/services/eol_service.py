from datetime import date, datetime
from typing import List, Optional, Tuple, Union
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.asset import Asset
from app.models.device_eol_reference import DeviceEolReference
from app.repositories.eol_repository import EolRepository
from app.schemas.eol import EolInfo, EolAssetItem, EolSummaryResponse
from app.schemas.eol_reference import EolReferenceResponse, EolReferenceCreate, EolReferenceUpdate
from app.schemas.common import PaginatedResponse


class EolService:
    """
    Business logic for hardware lifecycle, EOL calculations, and reference management.
    EOL status is calculated at request time and never persisted to the database.
    """

    get_eol_subquery = EolRepository.get_eol_subquery
    get_eol_join_condition = EolRepository.get_eol_join_condition

    @staticmethod
    def calculate_eol(
        eol_date: Optional[Union[date, datetime]],
        warning_days: Optional[int] = None,
        as_of_date: Optional[date] = None,
    ) -> Tuple[str, Optional[int]]:
        """
        Evaluate EOL state:
        - Missing matching date -> UNKNOWN
        - Date before today -> EXPIRED
        - Date from today through today + warning_days (inclusive) -> EOL SOON
        - Date beyond threshold -> ACTIVE
        """
        if eol_date is None:
            return "UNKNOWN", None

        if isinstance(eol_date, datetime):
            eol_date = eol_date.date()

        today = as_of_date or date.today()
        days_remaining = (eol_date - today).days
        threshold = warning_days if warning_days is not None else settings.EOL_WARNING_DAYS

        if days_remaining < 0:
            return "EXPIRED", days_remaining
        elif 0 <= days_remaining <= threshold:
            return "EOL SOON", days_remaining
        else:
            return "ACTIVE", days_remaining

    @classmethod
    def get_asset_eol_info(
        cls, db: Session, asset: Asset, warning_days: Optional[int] = None
    ) -> EolInfo:
        ref = EolRepository.get_eol_for_device(db, asset.manufacturer, asset.model)
        if not ref or not ref.eol_date:
            return EolInfo(
                eol_date=None,
                days_remaining=None,
                eol_status="UNKNOWN",
                reference_source=None,
            )

        status, days = cls.calculate_eol(ref.eol_date, warning_days=warning_days)
        return EolInfo(
            eol_date=ref.eol_date,
            days_remaining=days,
            eol_status=status,
            reference_source=ref.reference_source,
        )

    @classmethod
    def list_references(
        cls,
        db: Session,
        page: int = 1,
        page_size: Optional[int] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[EolReferenceResponse], int]:
        skip = (page - 1) * page_size if page_size else 0
        items, total_count = EolRepository.list_references(
            db=db,
            skip=skip,
            limit=page_size,
            manufacturer=manufacturer,
            model=model,
            search=search,
        )
        responses = [EolReferenceResponse.model_validate(item) for item in items]
        return responses, total_count

    @classmethod
    def get_reference(cls, db: Session, eol_id: int) -> Optional[EolReferenceResponse]:
        record = EolRepository.get_reference_by_id(db, eol_id)
        if not record:
            return None
        return EolReferenceResponse.model_validate(record)

    @classmethod
    def upsert_reference(
        cls, db: Session, data: EolReferenceCreate, actor: Optional[any] = None
    ) -> Tuple[EolReferenceResponse, bool]:
        from app.services.audit_service import AuditService
        existing = EolRepository.get_eol_for_device(db, data.manufacturer, data.model)
        old_values = None
        if existing:
            old_values = {
                "manufacturer": existing.manufacturer,
                "model": existing.model,
                "eol_date": str(existing.eol_date) if existing.eol_date else None,
                "reference_source": existing.reference_source,
            }

        record, is_created = EolRepository.upsert_reference(
            db=db,
            manufacturer=data.manufacturer,
            model=data.model,
            eol_date=data.eol_date,
            reference_source=data.reference_source,
        )

        new_values = {
            "manufacturer": record.manufacturer,
            "model": record.model,
            "eol_date": str(record.eol_date) if record.eol_date else None,
            "reference_source": record.reference_source,
        }

        if is_created:
            AuditService.record_audit(
                db=db,
                actor=actor,
                category="EOL MANAGEMENT",
                action="CREATE MODEL",
                entity_type="EOL MODEL",
                entity_id=str(record.eol_id),
                entity_name=f"{record.manufacturer} {record.model}",
                audit_finding=f"Created EOL reference model '{record.manufacturer} {record.model}' with EOL date {record.eol_date}.",
                new_values=new_values,
                status="SUCCESS",
                commit=True,
            )
        else:
            AuditService.record_audit(
                db=db,
                actor=actor,
                category="EOL MANAGEMENT",
                action="EDIT MODEL",
                entity_type="EOL MODEL",
                entity_id=str(record.eol_id),
                entity_name=f"{record.manufacturer} {record.model}",
                audit_finding=f"Updated EOL reference model '{record.manufacturer} {record.model}' (EOL date: {record.eol_date}).",
                old_values=old_values,
                new_values=new_values,
                status="SUCCESS",
                commit=True,
            )

        return EolReferenceResponse.model_validate(record), is_created

    @classmethod
    def create_reference(
        cls, db: Session, data: EolReferenceCreate, actor: Optional[any] = None
    ) -> EolReferenceResponse:
        response, _ = cls.upsert_reference(db=db, data=data, actor=actor)
        return response

    @classmethod
    def update_reference(
        cls, db: Session, eol_id: int, data: EolReferenceUpdate, actor: Optional[any] = None
    ) -> Optional[EolReferenceResponse]:
        from app.services.audit_service import AuditService
        existing = EolRepository.get_reference_by_id(db, eol_id)
        if not existing:
            return None

        old_values = {
            "manufacturer": existing.manufacturer,
            "model": existing.model,
            "eol_date": str(existing.eol_date) if existing.eol_date else None,
            "reference_source": existing.reference_source,
        }

        record = EolRepository.update_reference(
            db=db,
            eol_id=eol_id,
            manufacturer=data.manufacturer,
            model=data.model,
            eol_date=data.eol_date,
            reference_source=data.reference_source,
        )
        if not record:
            return None

        new_values = {
            "manufacturer": record.manufacturer,
            "model": record.model,
            "eol_date": str(record.eol_date) if record.eol_date else None,
            "reference_source": record.reference_source,
        }

        AuditService.record_audit(
            db=db,
            actor=actor,
            category="EOL MANAGEMENT",
            action="EDIT MODEL",
            entity_type="EOL MODEL",
            entity_id=str(record.eol_id),
            entity_name=f"{record.manufacturer} {record.model}",
            audit_finding=f"Updated EOL reference model '{record.manufacturer} {record.model}' (EOL date: {record.eol_date}).",
            old_values=old_values,
            new_values=new_values,
            status="SUCCESS",
            commit=True,
        )
        return EolReferenceResponse.model_validate(record)

    @classmethod
    def delete_reference(
        cls, db: Session, eol_id: int, actor: Optional[any] = None
    ) -> bool:
        from app.services.audit_service import AuditService
        existing = EolRepository.get_reference_by_id(db, eol_id)
        if not existing:
            return False

        old_values = {
            "manufacturer": existing.manufacturer,
            "model": existing.model,
            "eol_date": str(existing.eol_date) if existing.eol_date else None,
            "reference_source": existing.reference_source,
        }
        mfg = existing.manufacturer
        mdl = existing.model

        deleted = EolRepository.delete_reference(db=db, eol_id=eol_id)
        if deleted:
            AuditService.record_audit(
                db=db,
                actor=actor,
                category="EOL MANAGEMENT",
                action="DELETE MODEL",
                entity_type="EOL MODEL",
                entity_id=str(eol_id),
                entity_name=f"{mfg} {mdl}",
                audit_finding=f"Deleted EOL reference model '{mfg} {mdl}'.",
                old_values=old_values,
                status="SUCCESS",
                commit=True,
            )
        return deleted

    @classmethod
    def get_paginated_eol_assets(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        source: Optional[str] = None,
        asset_status: Optional[str] = None,
        devicetype: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[EolAssetItem]:
        skip = (page - 1) * page_size
        results, total_count = EolRepository.get_all_assets_with_eol_reference(
            db=db,
            skip=skip,
            limit=page_size,
            source=source,
            asset_status=asset_status,
            devicetype=devicetype,
            manufacturer=manufacturer,
            model=model,
            search=search,
        )

        items: list[EolAssetItem] = []
        for asset, eol_date, ref_source in results:
            status, days = cls.calculate_eol(eol_date)
            items.append(
                EolAssetItem(
                    asset_id=asset.asset_id,
                    asset_number=asset.asset_number,
                    serial_number=asset.serial_number,
                    source=asset.source,
                    manufacturer=asset.manufacturer,
                    model=asset.model,
                    os_name=asset.os_name,
                    macaddress=asset.macaddress,
                    devicetype=asset.devicetype,
                    managed_by=asset.managed_by,
                    assigned_username=asset.assigned_username,
                    asset_status=asset.asset_status,
                    assignment_type=asset.assignment_type,
                    lastreporttime=asset.lastreporttime,
                    last_synced_at=asset.last_synced_at,
                    eol_date=eol_date,
                    days_remaining=days,
                    eol_status=status,
                    reference_source=ref_source,
                )
            )

        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0
        return PaginatedResponse(
            items=items,
            total=total_count,
            total_items=total_count,
            total_pages=total_pages,
            page=page,
            page_size=page_size,
        )

    @classmethod
    def get_eol_summary(cls, db: Session, source: Optional[str] = None) -> EolSummaryResponse:
        """
        Compute dashboard aggregate counts for Active, Nearing EOL, Expired, and Unknown.
        Supports filtering by discovery source.
        """
        all_evals = EolRepository.get_all_assets_for_eol_evaluation(db, source=source)
        active_cnt = 0
        nearing_cnt = 0
        expired_cnt = 0
        unknown_cnt = 0

        for _, _, _, eol_date in all_evals:
            status, _ = cls.calculate_eol(eol_date)
            status_upper = status.upper()
            if status_upper == "ACTIVE":
                active_cnt += 1
            elif status_upper in ("EOL SOON", "NEARING EOL"):
                nearing_cnt += 1
            elif status_upper == "EXPIRED":
                expired_cnt += 1
            else:
                unknown_cnt += 1

        return EolSummaryResponse(
            active_count=active_cnt,
            nearing_eol_count=nearing_cnt,
            expired_count=expired_cnt,
            unknown_count=unknown_cnt,
            warning_threshold_days=settings.EOL_WARNING_DAYS,
            total_evaluated=len(all_evals),
        )

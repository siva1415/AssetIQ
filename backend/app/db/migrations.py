"""
Database migration utilities for AssetIQ.
Provides transactional migration of legacy asset_status records and schema constraints.
"""

from typing import List, Tuple
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.core.logging import logger

ALLOWED_LEGACY_OR_TARGET = {
    "ACTIVE",
    "Active",
    "active",
    "REVIEW",
    "Review",
    "review",
    "NEED VALIDATION",
    "Need Validation",
    "need validation",
    "need_validation",
    "IN STOCK",
    "InStock",
    "instock",
    "in stock",
    "in_stock",
    "RETIRED",
    "Retired",
    "retired",
}

STATUS_MIGRATION_MAP = {
    "Active": "ACTIVE",
    "active": "ACTIVE",
    "Review": "REVIEW",
    "review": "REVIEW",
    "NEED VALIDATION": "REVIEW",
    "Need Validation": "REVIEW",
    "need validation": "REVIEW",
    "need_validation": "REVIEW",
    "InStock": "IN STOCK",
    "instock": "IN STOCK",
    "in stock": "IN STOCK",
    "in_stock": "IN STOCK",
    "Retired": "RETIRED",
    "retired": "RETIRED",
}


def migrate_asset_status_records(db: Session) -> Tuple[int, List[int]]:
    """
    Safely migrates legacy asset_status records to exact uppercase values:
      - Active -> ACTIVE
      - Need Validation / Review -> REVIEW
      - InStock -> IN STOCK
      - Retired -> RETIRED

    Transactionally executes within the session.
    Preserves NULL values explicitly without overwriting.
    Raises ValueError on unexpected/invalid non-NULL values to prevent silent overwriting.

    Returns (migrated_count, list_of_modified_asset_ids).
    """
    try:
        # 1. Inspect existing non-NULL records
        stmt = select(Asset.asset_id, Asset.asset_status).where(Asset.asset_status.is_not(None))
        rows = db.execute(stmt).all()

        unexpected = [
            (row.asset_id, row.asset_status)
            for row in rows
            if row.asset_status not in ALLOWED_LEGACY_OR_TARGET
        ]
        if unexpected:
            raise ValueError(
                f"Aborting migration: Found {len(unexpected)} row(s) with unexpected asset_status: {unexpected}"
            )

        migrated_ids: List[int] = []
        for row in rows:
            old_val = row.asset_status
            new_val = STATUS_MIGRATION_MAP.get(old_val)
            if new_val and new_val != old_val:
                db.execute(
                    update(Asset)
                    .where(Asset.asset_id == row.asset_id)
                    .values(asset_status=new_val)
                )
                migrated_ids.append(row.asset_id)

        db.commit()
        logger.info(f"Successfully migrated {len(migrated_ids)} asset records to uppercase status.")
        return len(migrated_ids), migrated_ids

    except Exception as exc:
        db.rollback()
        logger.error(f"Migration rolled back due to error: {exc}")
        raise

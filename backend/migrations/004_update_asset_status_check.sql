-- Migration: 004_update_asset_status_check.sql
-- Description: Extend assets_asset_status_check constraint to include INSTOCK and EXPIRED.

BEGIN;

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_status_check;

ALTER TABLE assets
ADD CONSTRAINT assets_asset_status_check
CHECK (
    asset_status IN (
        'ACTIVE',
        'REVIEW',
        'INSTOCK',
        'IN STOCK',
        'EXPIRED',
        'RETIRED'
    )
);

COMMIT;

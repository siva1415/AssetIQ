-- Migration: 001_update_asset_status_check.sql
-- Description: Safely migrate legacy asset_status records and update assets_asset_status_check constraint to exact uppercase values.

BEGIN;

-- 1. Inspect existing records: Validate that non-conforming, non-legacy values do not exist
-- Unexpected values raise an explicit error rather than being silently overwritten.
DO $$
DECLARE
    unexpected_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unexpected_count
    FROM assets
    WHERE asset_status IS NOT NULL
      AND asset_status NOT IN (
          'ACTIVE', 'Active', 'active',
          'REVIEW', 'Review', 'review',
          'NEED VALIDATION', 'Need Validation', 'need validation', 'need_validation',
          'IN STOCK', 'InStock', 'instock', 'in stock', 'in_stock',
          'RETIRED', 'Retired', 'retired'
      );
    IF unexpected_count > 0 THEN
        RAISE EXCEPTION 'Aborting migration: % row(s) contain unexpected asset_status values', unexpected_count;
    END IF;
END $$;

-- 2. Safely migrate legacy values to exact uppercase values
UPDATE assets
SET asset_status = CASE
    WHEN asset_status IN ('Active', 'active') THEN 'ACTIVE'
    WHEN asset_status IN ('Review', 'review') THEN 'REVIEW'
    WHEN asset_status IN ('NEED VALIDATION', 'Need Validation', 'need validation', 'need_validation') THEN 'REVIEW'
    WHEN asset_status IN ('InStock', 'instock', 'in stock', 'in_stock') THEN 'IN STOCK'
    WHEN asset_status IN ('Retired', 'retired') THEN 'RETIRED'
    ELSE asset_status
END
WHERE asset_status IS NOT NULL;

-- 3. Update PostgreSQL CHECK constraint
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_status_check;

ALTER TABLE assets
ADD CONSTRAINT assets_asset_status_check
CHECK (
    asset_status IN (
        'ACTIVE',
        'REVIEW',
        'IN STOCK',
        'RETIRED'
    )
);

COMMIT;


BEGIN;

CREATE TABLE IF NOT EXISTS workday_employees (
    employee_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    email_work VARCHAR(255),
    email_home VARCHAR(255),
    department VARCHAR(150),
    division VARCHAR(150),
    job_title VARCHAR(150),
    employee_status VARCHAR(30) NOT NULL DEFAULT 'Active',
    manager_user_name VARCHAR(50),
    manager_name VARCHAR(200),
    location VARCHAR(150),
    hire_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
    asset_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_number VARCHAR(150) NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    source VARCHAR(10) NOT NULL
        CHECK (source IN ('BIGFIX', 'JAMF')),
    manufacturer VARCHAR(100) NOT NULL,
    model VARCHAR(150) NOT NULL,
    os_name VARCHAR(100) NOT NULL,
    macaddress VARCHAR(50),
    devicetype VARCHAR(30) NOT NULL
        CHECK (devicetype IN ('Server', 'Desktop')),
    managed_by VARCHAR(20) NOT NULL
        CHECK (managed_by IN ('GROUP', 'INDIVIDUAL')),
    assigned_username VARCHAR(150),
    lastreporttime TIMESTAMPTZ,
    asset_status VARCHAR(30) NOT NULL DEFAULT 'Active'
        CHECK (
            asset_status IN (
                'Active',
                'Need Validation',
                'InStock'
            )
        ),
    assignment_type VARCHAR(10)
        CHECK (
            assignment_type IN ('AUTO', 'MANUAL')
            OR assignment_type IS NULL
        ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_assets_source_number
        UNIQUE (source, asset_number),

    CONSTRAINT uq_assets_source_serial
        UNIQUE (source, serial_number)
);

CREATE TABLE IF NOT EXISTS device_eol_reference (
    eol_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    manufacturer VARCHAR(100) NOT NULL,
    model VARCHAR(150) NOT NULL,
    eol_date DATE,
    reference_source VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT uq_eol_manufacturer_model
        UNIQUE (manufacturer, model)
);

CREATE TABLE IF NOT EXISTS admin_users (
    admin_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_user_id VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Add remarks column to the assets table
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Add computer_id column to the assets table
ALTER TABLE assets
ADD COLUMN computer_id VARCHAR(100);

-- Indexes for dashboard filtering and user correlation
CREATE INDEX IF NOT EXISTS idx_workday_user_id
    ON workday_employees(user_id);

CREATE INDEX IF NOT EXISTS idx_workday_status
    ON workday_employees(employee_status);

CREATE INDEX IF NOT EXISTS idx_assets_source
    ON assets(source);

CREATE INDEX IF NOT EXISTS idx_assets_assigned_username
    ON assets(assigned_username);

CREATE INDEX IF NOT EXISTS idx_assets_status
    ON assets(asset_status);

CREATE INDEX IF NOT EXISTS idx_assets_model
    ON assets(manufacturer, model);

CREATE INDEX IF NOT EXISTS idx_assets_lastreporttime
    ON assets(lastreporttime);

COMMIT;

-- Migration: 003_create_audit_logs.sql
-- Description: Create audit_logs table for AssetIQ audit logging feature

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id SERIAL PRIMARY KEY,
    asset_tag VARCHAR(100),
    portal_user_id INTEGER,
    portal_username VARCHAR(100),
    portal_user_full_name VARCHAR(150),
    portal_user_role VARCHAR(50),
    category VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    entity_name VARCHAR(255),
    audit_finding TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILURE')),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_detected_at ON audit_logs(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_portal_username ON audit_logs(portal_username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_asset_tag ON audit_logs(asset_tag);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- 1. Console Users Table
CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(100) PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,            -- PBKDF2-HMAC-SHA256 or bcrypt hash
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'viewer')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    must_change_password BOOLEAN DEFAULT FALSE,
    is_otp BOOLEAN DEFAULT FALSE,
    is_root_protected BOOLEAN DEFAULT FALSE,        -- True for @superadmin
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Real-Time Active Sessions Table
CREATE TABLE IF NOT EXISTS active_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    login_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'expired'))
);

-- Indexes for fast lookup & polling
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_active_sessions_username ON active_sessions(username);
CREATE INDEX IF NOT EXISTS idx_active_sessions_status ON active_sessions(status);
-- Insert console users
INSERT INTO users (username, password_hash, role, name, email, must_change_password, is_otp, is_root_protected)
VALUES 
    ('admin', 'pbkdf2_sha256$260000$hash_admin', 'admin', 'Administrator', 'admin@workforceiq.internal', FALSE, FALSE, FALSE),
    ('alex', 'pbkdf2_sha256$260000$hash_alex', 'admin', 'Alex Morgan', 'alex@workforceiq.internal', FALSE, FALSE, FALSE),
    ('elena', 'pbkdf2_sha256$260000$hash_elena', 'admin', 'Elena Rostova', 'elena.rostova@workforceiq.corp', FALSE, FALSE, FALSE),
    ('firstuser', 'pbkdf2_sha256$260000$hash_temp123', 'viewer', 'Alex Morgan (First Login OTP)', 'firstuser@workforceiq.internal', TRUE, TRUE, FALSE),
    ('sachin', 'pbkdf2_sha256$260000$hash_sachin', 'super_admin', 'Sachin', 'sachin@123.com', FALSE, FALSE, FALSE),
    ('superadmin', 'pbkdf2_sha256$260000$hash_superadmin', 'super_admin', 'Super Administrator', 'superadmin@workforceiq.internal', FALSE, FALSE, TRUE),
    ('marcus', 'pbkdf2_sha256$260000$hash_marcus', 'viewer', 'Marcus Kane', 'marcus.kane@workforceiq.internal', FALSE, FALSE, FALSE),
    ('jdoe', 'pbkdf2_sha256$260000$hash_jdoe', 'admin', 'Jane Doe', 'jdoe@workforceiq.internal', FALSE, FALSE, FALSE)
ON CONFLICT (username) DO NOTHING;

-- Insert active sessions (5 online users)
INSERT INTO active_sessions (session_id, username, name, email, role, login_time, last_active, ip_address, user_agent, status)
VALUES 
    ('sess_admin_01', 'admin', 'Administrator', 'admin@workforceiq.internal', 'admin', NOW() - INTERVAL '15 minutes', NOW(), '192.168.1.45', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0', 'active'),
    ('sess_sachin_02', 'sachin', 'Sachin', 'sachin@123.com', 'super_admin', NOW() - INTERVAL '35 minutes', NOW(), '10.0.4.12', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/121.0.0.0', 'active'),
    ('sess_superadmin_03', 'superadmin', 'Super Administrator', 'superadmin@workforceiq.internal', 'super_admin', NOW() - INTERVAL '2 hours', NOW(), '192.168.1.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0', 'active'),
    ('sess_marcus_04', 'marcus', 'Marcus Kane', 'marcus.kane@workforceiq.internal', 'viewer', NOW() - INTERVAL '50 minutes', NOW(), '10.0.8.91', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0', 'active'),
    ('sess_jdoe_05', 'jdoe', 'Jane Doe', 'jdoe@workforceiq.internal', 'admin', NOW() - INTERVAL '10 minutes', NOW(), '192.168.1.88', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.2 Safari/605.1.15', 'active')
ON CONFLICT (session_id) DO NOTHING;
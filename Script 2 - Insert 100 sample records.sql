
BEGIN;

-- EOL reference sample data
INSERT INTO device_eol_reference
    (manufacturer, model, eol_date, reference_source)
VALUES
    ('Dell', 'OptiPlex 7010', CURRENT_DATE + 720, 'Sample'),
    ('Dell', 'PowerEdge R650', CURRENT_DATE + 1200, 'Sample'),
    ('HP', 'EliteDesk 800 G9', CURRENT_DATE + 45, 'Sample'),
    ('HP', 'ProDesk 600 G6', CURRENT_DATE - 30, 'Sample'),
    ('Lenovo', 'ThinkCentre M90q', CURRENT_DATE + 400, 'Sample'),
    ('Lenovo', 'ThinkSystem SR650', CURRENT_DATE + 60, 'Sample'),
    ('Apple', 'Mac mini M2', CURRENT_DATE + 900, 'Sample'),
    ('Apple', 'Mac Studio M2', CURRENT_DATE + 30, 'Sample')
ON CONFLICT (manufacturer, model) DO NOTHING;


-- 100 Workday employees
INSERT INTO workday_employees (
    user_id, full_name, email_work, email_home,
    department, division, job_title, employee_status,
    manager_user_name, manager_name, location, hire_date,
    created_at, updated_at, last_synced_at
)
SELECT
    'user' || LPAD(g::TEXT, 4, '0'),
    (ARRAY['Aarav','Aadhya','Arjun','Diya','Ishaan',
           'Kavya','Neha','Rahul','Priya','Vikram'])
        [(g-1)%10+1]
    || ' ' ||
    (ARRAY['Sharma','Rao','Iyer','Patel','Nair',
           'Reddy','Mehta','Kumar','Das','Singh'])
        [((g*3)-1)%10+1],
    'user' || LPAD(g::TEXT, 4, '0') || '@assetiq.example',
    'home' || LPAD(g::TEXT, 4, '0') || '@example.net',
    (ARRAY['IT Operations','Engineering','Infrastructure',
           'Security','Store Operations'])[(g-1)%5+1],
    (ARRAY['Technology','Corporate IT','Operations'])[(g-1)%3+1],
    (ARRAY['Software Engineer','Systems Engineer',
           'Delivery Lead','Analyst','IT Support Engineer'])
        [(g-1)%5+1],
    CASE WHEN g%25=0 THEN 'Inactive' ELSE 'Active' END,
    'manager' || LPAD(GREATEST(1,((g-1)/10)::INT)::TEXT,3,'0'),
    'Manager ' || LPAD(GREATEST(1,((g-1)/10)::INT)::TEXT,2,'0'),
    (ARRAY['Chennai','Bengaluru','Hyderabad',
           'Pune','Mumbai','Delhi'])[(g-1)%6+1],
    DATE '2018-01-01' + ((g*17)%2800),
    NOW(), NOW(), NOW()
FROM generate_series(1,100) AS s(g)
ON CONFLICT (user_id) DO NOTHING;


-- 50 HCL BigFix Windows assets
INSERT INTO assets (
    asset_number, serial_number, source, manufacturer, model,
    os_name, macaddress, devicetype, managed_by,
    assigned_username, lastreporttime, asset_status,
    assignment_type, created_at, updated_at, last_synced_at
)
SELECT
    'BF-ASSET-' || LPAD(g::TEXT,5,'0'),
    'BF-SN-' || LPAD(g::TEXT,6,'0'),
    'BIGFIX',
    CASE WHEN g%3=0 THEN 'Dell'
         WHEN g%3=1 THEN 'HP'
         ELSE 'Lenovo' END,
    CASE
        WHEN g%3=0 THEN
            (ARRAY['OptiPlex 7010','PowerEdge R650'])[(g-1)%2+1]
        WHEN g%3=1 THEN
            (ARRAY['EliteDesk 800 G9','ProDesk 600 G6'])[(g-1)%2+1]
        ELSE
            (ARRAY['ThinkCentre M90q','ThinkSystem SR650'])[(g-1)%2+1]
    END,
    CASE WHEN g%2=0
         THEN 'Windows 11 Professional'
         ELSE 'Windows 10 Professional' END,
    '02:1A:' || LPAD(TO_HEX((g*3)%256),2,'0') || ':' ||
    LPAD(TO_HEX((g*5)%256),2,'0') || ':' ||
    LPAD(TO_HEX((g*7)%256),2,'0') || ':' ||
    LPAD(TO_HEX((g*11)%256),2,'0'),
    CASE WHEN g%5=0 THEN 'Server' ELSE 'Desktop' END,
    CASE WHEN g%2=0 THEN 'INDIVIDUAL' ELSE 'GROUP' END,
    CASE
        WHEN g%10=0 THEN 'Administrator'
        WHEN g%10=1 THEN NULL
        WHEN g%10=2 THEN 'unknown' || LPAD(g::TEXT,4,'0')
        ELSE 'user' || LPAD(g::TEXT,4,'0')
    END,
    NOW() - ((g%21)::TEXT || ' days')::INTERVAL,
    CASE
        WHEN g%10 IN (1,2) THEN 'Need Validation'
        WHEN g%15=0 THEN 'InStock'
        ELSE 'Active'
    END,
    CASE
        WHEN g%10 IN (0,1,2) THEN NULL
        WHEN g%2=0 THEN 'AUTO'
        ELSE 'MANUAL'
    END,
    NOW(), NOW(), NOW()
FROM generate_series(1,50) AS s(g)
ON CONFLICT (source, asset_number) DO NOTHING;


-- 50 Jamf Mac assets
INSERT INTO assets (
    asset_number, serial_number, source, manufacturer, model,
    os_name, macaddress, devicetype, managed_by,
    assigned_username, lastreporttime, asset_status,
    assignment_type, created_at, updated_at, last_synced_at
)
SELECT
    'JAMF-ASSET-' || LPAD(g::TEXT,5,'0'),
    'JAMF-SN-' || LPAD(g::TEXT,6,'0'),
    'JAMF',
    'Apple',
    CASE WHEN g%2=0 THEN 'Mac mini M2' ELSE 'Mac Studio M2' END,
    CASE WHEN g%2=0 THEN 'macOS Sonoma' ELSE 'macOS Sequoia' END,
    'A4:5E:' || LPAD(TO_HEX((g*13)%256),2,'0') || ':' ||
    LPAD(TO_HEX((g*17)%256),2,'0') || ':' ||
    LPAD(TO_HEX((g*19)%256),2,'0') || ':' ||
    LPAD(TO_HEX((g*23)%256),2,'0'),
    'Desktop',
    CASE WHEN g%2=0 THEN 'INDIVIDUAL' ELSE 'GROUP' END,
    CASE
        WHEN g%10=0 THEN 'admin'
        WHEN g%10=1 THEN NULL
        WHEN g%10=2 THEN 'former.user' || g::TEXT
        ELSE 'user' || LPAD((g+50)::TEXT,4,'0')
    END,
    NOW() - ((g%14)::TEXT || ' days')::INTERVAL,
    CASE
        WHEN g%10 IN (1,2) THEN 'Need Validation'
        WHEN g%15=0 THEN 'InStock'
        ELSE 'Active'
    END,
    CASE
        WHEN g%10 IN (0,1,2) THEN NULL
        WHEN g%2=0 THEN 'AUTO'
        ELSE 'MANUAL'
    END,
    NOW(), NOW(), NOW()
FROM generate_series(1,50) AS s(g)
ON CONFLICT (source, asset_number) DO NOTHING;

COMMIT;

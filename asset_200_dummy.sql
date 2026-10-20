-- Distinct dummy data for the assets table (200 rows)
-- Safe to run after dropping the CHECK constraints.
-- asset_number, serial_number and macaddress are unique per row (derived from g),
-- and prefixes differ from the earlier BF-/JAMF- sample script so nothing collides.

BEGIN;

INSERT INTO assets (
    asset_number, serial_number, source, manufacturer, model,
    os_name, macaddress, devicetype, managed_by,
    assigned_username, lastreporttime, asset_status,
    assignment_type, created_at, updated_at, last_synced_at
)
SELECT
    -- distinct identifiers
    'AST-' || LPAD(g::TEXT, 6, '0'),
    'SN-' || UPPER(SUBSTR(MD5('serial-' || g::TEXT), 1, 10)) || LPAD(g::TEXT, 4, '0'),

    -- source (4 systems, evenly spread)
    (ARRAY['BIGFIX','JAMF','INTUNE','SCCM'])[(g-1)%4+1],

    -- manufacturer + matching model
    mm.manufacturer,
    mm.model,

    -- OS depends on manufacturer
    CASE
        WHEN mm.manufacturer = 'Apple'
            THEN (ARRAY['macOS Sonoma','macOS Sequoia','macOS Ventura'])[(g-1)%3+1]
        WHEN mm.devicetype = 'Server'
            THEN (ARRAY['Windows Server 2019','Windows Server 2022','Ubuntu Server 22.04','RHEL 9'])[(g-1)%4+1]
        WHEN mm.devicetype = 'Mobile'
            THEN (ARRAY['Android 14','iOS 17','iOS 18'])[(g-1)%3+1]
        ELSE (ARRAY['Windows 10 Professional','Windows 11 Professional','Windows 11 Enterprise'])[(g-1)%3+1]
    END,

    -- unique MAC: g encoded in the last 4 bytes
    '02:' || SUBSTR(LPAD(TO_HEX(g), 8, '0'), 1, 2) || ':' ||
             SUBSTR(LPAD(TO_HEX(g), 8, '0'), 3, 2) || ':' ||
             SUBSTR(LPAD(TO_HEX(g), 8, '0'), 5, 2) || ':' ||
             SUBSTR(LPAD(TO_HEX(g), 8, '0'), 7, 2) || ':' ||
             LPAD(TO_HEX((g*37)%256), 2, '0'),

    mm.devicetype,

    CASE WHEN g%2=0 THEN 'INDIVIDUAL' ELSE 'GROUP' END,

    -- assigned user: mix of normal, admin, unassigned, orphaned
    CASE
        WHEN g%12=0 THEN 'Administrator'
        WHEN g%12=1 THEN NULL
        WHEN g%12=2 THEN 'former.user' || g::TEXT
        ELSE 'user' || LPAD(((g-1)%100+1)::TEXT, 4, '0')
    END,

    -- last report time spread over ~60 days, with varying hours
    NOW() - ((g%60)::TEXT || ' days')::INTERVAL
          - (((g*7)%24)::TEXT || ' hours')::INTERVAL,

    CASE
        WHEN g%12 IN (1,2)  THEN 'Need Validation'
        WHEN g%15=0         THEN 'InStock'
        WHEN g%20=0         THEN 'Retired'
        WHEN g%18=0         THEN 'In Repair'
        ELSE 'Active'
    END,

    CASE
        WHEN g%12 IN (0,1,2) THEN NULL
        WHEN g%2=0 THEN 'AUTO'
        ELSE 'MANUAL'
    END,

    NOW(), NOW(), NOW()
FROM generate_series(1, 200) AS s(g)
CROSS JOIN LATERAL (
    SELECT
        (ARRAY['Dell','HP','Lenovo','Apple','Microsoft','Cisco','Samsung'])[(g-1)%7+1] AS manufacturer,
        CASE (g-1)%7
            WHEN 0 THEN (ARRAY['OptiPlex 7010','Latitude 5440','PowerEdge R650','Precision 3660'])[(g-1)/7%4+1]
            WHEN 1 THEN (ARRAY['EliteDesk 800 G9','ProBook 450 G10','ProDesk 600 G6','ProLiant DL380'])[(g-1)/7%4+1]
            WHEN 2 THEN (ARRAY['ThinkCentre M90q','ThinkPad T14','ThinkSystem SR650','ThinkPad X1 Carbon'])[(g-1)/7%4+1]
            WHEN 3 THEN (ARRAY['Mac mini M2','Mac Studio M2','MacBook Pro 14','MacBook Air M2'])[(g-1)/7%4+1]
            WHEN 4 THEN (ARRAY['Surface Pro 9','Surface Laptop 5','Surface Studio 2','Surface Go 4'])[(g-1)/7%4+1]
            WHEN 5 THEN (ARRAY['UCS C220','Catalyst 9300','UCS C240','Meraki MX68'])[(g-1)/7%4+1]
            ELSE        (ARRAY['Galaxy Tab S9','Galaxy S23','Galaxy Book3','Galaxy Tab A9'])[(g-1)/7%4+1]
        END AS model,
        CASE
            WHEN (g-1)%7 = 5 AND (g-1)/7%4 IN (0,2) THEN 'Server'
            WHEN (g-1)%7 = 5 THEN 'Network'
            WHEN (g-1)%7 = 6 AND (g-1)/7%4 IN (0,1,3) THEN 'Mobile'
            WHEN (g-1)%7 = 0 AND (g-1)/7%4 = 2 THEN 'Server'
            WHEN (g-1)%7 = 1 AND (g-1)/7%4 = 3 THEN 'Server'
            WHEN (g-1)%7 = 2 AND (g-1)/7%4 = 2 THEN 'Server'
            WHEN (g-1)%7 IN (1,2,4) AND (g-1)/7%4 IN (1,3) THEN 'Laptop'
            WHEN (g-1)%7 = 0 AND (g-1)/7%4 = 1 THEN 'Laptop'
            WHEN (g-1)%7 = 3 AND (g-1)/7%4 >= 2 THEN 'Laptop'
            ELSE 'Desktop'
        END AS devicetype
) AS mm
ON CONFLICT (source, asset_number) DO NOTHING;

COMMIT;

-- Sanity checks
-- SELECT COUNT(*), COUNT(DISTINCT asset_number), COUNT(DISTINCT serial_number), COUNT(DISTINCT macaddress)
-- FROM assets WHERE asset_number LIKE 'AST-%';
-- SELECT source, devicetype, asset_status, COUNT(*) FROM assets
-- WHERE asset_number LIKE 'AST-%' GROUP BY 1,2,3 ORDER BY 1,2,3;
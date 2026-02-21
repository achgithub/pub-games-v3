-- Register leaderboard app in applications table
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_leaderboard_app.sql

-- Check if leaderboard already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM applications WHERE slug = 'leaderboard') THEN
        INSERT INTO applications (
            name,
            slug,
            port,
            description,
            category,
            icon,
            enabled,
            display_order,
            required_roles,
            guest_accessible,
            realtime_support
        ) VALUES (
            'Leaderboard',
            'leaderboard',
            5030,
            'View standings and recent games across all Activity Hub games',
            'utility',
            '🏆',
            true,
            60,
            '{}',
            true,
            'none'
        );
        RAISE NOTICE 'Leaderboard app registered successfully';
    ELSE
        RAISE NOTICE 'Leaderboard app already exists';
    END IF;
END $$;

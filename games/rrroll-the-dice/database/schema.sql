-- Rrroll the Dice - Database Registration
-- This app has no app-specific tables, only needs registry entry

-- Register app in activity_hub.applications table
-- Run on activity_hub database
INSERT INTO applications (
    id,
    name,
    icon,
    type,
    description,
    category,
    url,
    backend_port,
    realtime,
    min_players,
    max_players,
    required_roles,
    enabled,
    display_order
) VALUES (
    'rrroll-the-dice',
    'Rrroll the Dice',
    '🎲',
    'iframe',
    'Roll up to 6 dice with style',
    'utility',
    'http://{host}:4071',
    4071,
    'none',
    0,
    0,
    '{}',  -- Public app (guest accessible)
    true,
    50
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    url = EXCLUDED.url,
    backend_port = EXCLUDED.backend_port,
    updated_at = CURRENT_TIMESTAMP;

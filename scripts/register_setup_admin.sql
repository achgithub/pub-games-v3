-- Register Setup Admin App in the applications table
-- This app requires setup_admin role

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
    display_order,
    required_roles,
    enabled
) VALUES (
    'setup-admin',
    'Setup Admin',
    '⚙️',
    'iframe',
    'System configuration and user management',
    'admin',
    'http://{host}:5020',
    5020,
    'none',
    100,  -- Higher display_order so it appears last
    ARRAY['setup_admin'],
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    required_roles = EXCLUDED.required_roles,
    enabled = EXCLUDED.enabled;

-- Verify registration
SELECT id, name, required_roles, enabled
FROM applications
WHERE id = 'setup-admin';

-- Migration: Register LMS Manager app in applications table
\c activity_hub;

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
  required_roles,
  enabled,
  display_order,
  guest_accessible
)
VALUES (
  'lms-manager',
  'LMS Manager',
  '🎯',
  'iframe',
  'Manage Last Man Standing games - create teams, players, rounds, and track results',
  'admin',
  'http://{host}:4022',
  4022,
  'none',
  '{"game_manager"}',
  true,
  80,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  url = EXCLUDED.url,
  backend_port = EXCLUDED.backend_port,
  realtime = EXCLUDED.realtime,
  required_roles = EXCLUDED.required_roles,
  enabled = EXCLUDED.enabled,
  display_order = EXCLUDED.display_order,
  guest_accessible = EXCLUDED.guest_accessible;

-- Register Bulls and Cows app in the activity hub
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_bulls_and_cows.sql

INSERT INTO applications (id, name, icon, type, category, description, url, backend_port, realtime, min_players, max_players, required_roles, enabled, display_order, guest_accessible)
VALUES (
  'bulls-and-cows',
  'Bulls and Cows',
  '🐂🐄',
  'iframe',
  'game',
  'Crack the secret code by guessing the right combination of colors or numbers',
  'http://{host}:4091',
  4091,
  'sse',
  0,
  2,
  '{}',
  true,
  45,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  type = EXCLUDED.type,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  backend_port = EXCLUDED.backend_port,
  realtime = EXCLUDED.realtime,
  min_players = EXCLUDED.min_players,
  max_players = EXCLUDED.max_players,
  required_roles = EXCLUDED.required_roles,
  enabled = EXCLUDED.enabled,
  display_order = EXCLUDED.display_order,
  guest_accessible = EXCLUDED.guest_accessible;

-- Register sweepstakes-knockout app in the activity hub
INSERT INTO applications (id, name, icon, type, category, description, url, backend_port, realtime, min_players, max_players, required_roles, enabled, display_order, guest_accessible)
VALUES (
  'sweepstakes-knockout',
  'Sweepstakes Knockout',
  '🏇',
  'iframe',
  'admin',
  'Manage sweepstakes for horse races, greyhounds, athletics, and more',
  'http://{host}:4032',
  4032,
  'none',
  1,
  999,
  ARRAY['game_manager'],
  true,
  50,
  false
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

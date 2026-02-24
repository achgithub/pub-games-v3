-- Register sweepstakes-knockout app in the activity hub
INSERT INTO applications (name, display_name, url_path, icon, category, description, display_order, is_enabled, required_roles, guest_accessible)
VALUES (
  'sweepstakes-knockout',
  'Sweepstakes Knockout',
  '/games/sweepstakes-knockout',
  '🏇',
  'games',
  'Manage sweepstakes for horse races, greyhounds, athletics, and more',
  50,
  true,
  ARRAY['game_manager'],
  false
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  url_path = EXCLUDED.url_path,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_enabled = EXCLUDED.is_enabled,
  required_roles = EXCLUDED.required_roles,
  guest_accessible = EXCLUDED.guest_accessible;

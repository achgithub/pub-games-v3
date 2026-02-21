-- Register leaderboard app in applications table
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_leaderboard_app.sql

INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, required_roles, enabled, display_order, guest_accessible)
VALUES
  ('leaderboard', 'Leaderboard', '🏆', 'iframe',
   'View standings and recent games across all Activity Hub games',
   'utility',
   'http://{host}:5030', 5030, 'none',
   '{}', true, 60, true)

ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  icon           = EXCLUDED.icon,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  backend_port   = EXCLUDED.backend_port,
  realtime       = EXCLUDED.realtime,
  required_roles = EXCLUDED.required_roles,
  display_order  = EXCLUDED.display_order,
  guest_accessible = EXCLUDED.guest_accessible;

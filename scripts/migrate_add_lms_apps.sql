-- Migration: Add Last Man Standing and Game Admin apps to the application registry
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_lms_apps.sql

INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, required_roles, enabled, display_order, guest_accessible)
VALUES
  ('last-man-standing', 'Last Man Standing', '🏆', 'iframe',
   'Football prediction - pick one team per round, last one standing wins',
   'game',
   'http://{host}:4021', 4021, 'none',
   '{}', true, 50, false),

  ('game-admin', 'Game Admin', '🎮', 'iframe',
   'Manage games, rounds, matches and results for Last Man Standing',
   'admin',
   'http://{host}:5070', 5070, 'none',
   '{"game_admin"}', true, 60, false)

ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  icon           = EXCLUDED.icon,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  backend_port   = EXCLUDED.backend_port,
  required_roles = EXCLUDED.required_roles,
  display_order  = EXCLUDED.display_order;

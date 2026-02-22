-- Migration: Add LMS Manager app to the application registry
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_lms_manager.sql

INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, required_roles, enabled, display_order, guest_accessible)
VALUES
  ('lms-manager', 'LMS Manager', '🎯', 'iframe',
   'Admin tool for managing Last Man Standing competitions (groups, teams, players, picks, results)',
   'admin',
   'http://{host}:4022', 4022, 'none',
   '{"game_admin"}', true, 61, false)

ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  icon           = EXCLUDED.icon,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  backend_port   = EXCLUDED.backend_port,
  required_roles = EXCLUDED.required_roles,
  display_order  = EXCLUDED.display_order;

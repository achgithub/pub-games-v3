-- Migration: Register Sweepstakes app in the application registry
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_sweepstakes_app.sql

INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, required_roles, enabled, display_order, guest_accessible)
VALUES
  ('sweepstakes', 'Sweepstakes', '🎁', 'iframe',
   'Blind box sweepstakes — pick your entry and see who gets what',
   'game',
   'http://{host}:4031', 4031, 'none',
   '{}', true, 51, false)

ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  icon           = EXCLUDED.icon,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  backend_port   = EXCLUDED.backend_port,
  required_roles = EXCLUDED.required_roles,
  display_order  = EXCLUDED.display_order;

-- Update game-admin description to reflect it now covers multiple games
UPDATE applications
SET description = 'Manage LMS games/rounds/results and Sweepstakes competitions'
WHERE id = 'game-admin';

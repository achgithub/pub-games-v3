-- Migration: Register Component Library app in the application registry
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_component_library.sql

INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, required_roles, enabled, display_order, guest_accessible)
VALUES
  ('component-library', 'Component Library', '📚', 'iframe',
   'Living style guide — showcases all Activity Hub CSS components with live examples and code snippets (admin only)',
   'utility',
   'http://{host}:5010', 5010, 'sse',
   '{"admin"}', true, 101, false)

ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  icon           = EXCLUDED.icon,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  backend_port   = EXCLUDED.backend_port,
  realtime       = EXCLUDED.realtime,
  required_roles = EXCLUDED.required_roles,
  display_order  = EXCLUDED.display_order;

-- Migration: Register Smoke Test app in the application registry
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_smoke_test.sql

INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, required_roles, enabled, display_order, guest_accessible)
VALUES
  ('smoke-test', 'Smoke Test', '🧪', 'iframe',
   'Reference implementation — demonstrates full Activity Hub stack (PostgreSQL + Redis + SSE + shared CSS)',
   'utility',
   'http://{host}:5010', 5010, 'sse',
   '{}', true, 100, false)

ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  icon           = EXCLUDED.icon,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  backend_port   = EXCLUDED.backend_port,
  realtime       = EXCLUDED.realtime,
  required_roles = EXCLUDED.required_roles,
  display_order  = EXCLUDED.display_order;

-- migrate_add_quiz_apps.sql
-- Registers quiz apps in the applications table (activity_hub database)
-- Run: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_quiz_apps.sql

INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, required_roles, enabled, display_order, guest_accessible)
VALUES
  ('quiz-player',  'Quiz Player',  '🧠', 'iframe', 'Join and play live pub quizzes',          'game',    'http://{host}:4041', 4041, 'sse', '{}',                      true, 50, false),
  ('quiz-master',  'Quiz Master',  '🎤', 'iframe', 'Run and control a live quiz session',      'admin',   'http://{host}:5080', 5080, 'sse', '{quiz_master,game_admin}', true, 51, false),
  ('quiz-display', 'Quiz Display', '📺', 'iframe', 'Full-screen TV display for quiz sessions', 'utility', 'http://{host}:5081', 5081, 'sse', '{}',                      true, 52, false),
  ('mobile-test',  'Mobile Test',  '📱', 'iframe', 'Verify media works on your device',        'utility', 'http://{host}:4061', 4061, 'none', '{}',                     true, 53, false)
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  icon           = EXCLUDED.icon,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  url            = EXCLUDED.url,
  backend_port   = EXCLUDED.backend_port,
  realtime       = EXCLUDED.realtime,
  required_roles = EXCLUDED.required_roles,
  display_order  = EXCLUDED.display_order;

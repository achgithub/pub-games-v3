-- migrate_add_quiz_apps.sql
-- Registers quiz apps in the applications table (activity_hub database)
-- Run: psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_quiz_apps.sql

INSERT INTO applications (id, name, description, url_template, icon, category, enabled, requires_roles, display_order)
VALUES
  ('quiz-player',  'Quiz Player',  'Join and play live pub quizzes',          'http://{host}:4041', '🧠', 'game',    true, '{}',                        50),
  ('quiz-master',  'Quiz Master',  'Run and control a live quiz session',      'http://{host}:5080', '🎤', 'admin',   true, '{quiz_master,game_admin}',   51),
  ('quiz-display', 'Quiz Display', 'Full-screen TV display for quiz sessions', 'http://{host}:5081', '📺', 'utility', true, '{}',                        52),
  ('mobile-test',  'Mobile Test',  'Verify media works on your device',        'http://{host}:4061', '📱', 'utility', true, '{}',                        53)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  url_template = EXCLUDED.url_template,
  icon        = EXCLUDED.icon,
  category    = EXCLUDED.category,
  enabled     = EXCLUDED.enabled,
  requires_roles = EXCLUDED.requires_roles,
  display_order = EXCLUDED.display_order;

-- migrate_add_quiz_role.sql
-- Documents the quiz_master role. No schema change needed — roles is TEXT[].
-- Run this as a no-op to document intent; the role string is used by quiz-master auth middleware.

-- To grant quiz_master role to a user:
-- UPDATE users SET roles = array_append(roles, 'quiz_master') WHERE email = 'user@example.com';

-- To view users with quiz_master role:
-- SELECT email, name, roles FROM users WHERE 'quiz_master' = ANY(roles);

-- Verify role column exists:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'roles';

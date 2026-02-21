-- Migration: Add game_manager role to users table
-- This role allows users to manage LMS games (separate from game_admin)

-- Example: Grant game_manager role to a user
-- UPDATE users SET roles = array_append(roles, 'game_manager') WHERE email = 'manager@example.com';

-- Note: This is a documentation file. The role is added via UPDATE statements as needed.
-- The game_manager role is checked by LMS Manager backend via activity-hub-common/auth middleware.

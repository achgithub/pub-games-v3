-- Fix user passwords with correct bcrypt hash for "123456"
UPDATE users SET code_hash = '$2a$10$uwXWNdFfI9GWqzaGuh3PPunUuKmK52mjpLihTmr5cMlwOEJlmTRd6' WHERE email = 'admin@pubgames.local';
UPDATE users SET code_hash = '$2a$10$uwXWNdFfI9GWqzaGuh3PPunUuKmK52mjpLihTmr5cMlwOEJlmTRd6' WHERE email = 'test@pubgames.local';
SELECT email, name FROM users;

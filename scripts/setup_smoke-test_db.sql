-- Database setup for Smoke Test
-- Run this on the Pi to create the app's database

CREATE DATABASE IF NOT EXISTS smoke_test_db;
GRANT ALL PRIVILEGES ON DATABASE smoke_test_db TO pubgames;

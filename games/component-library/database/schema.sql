-- Component Library Database Schema
-- Database: component_library_db
-- Purpose: Activity Hub Component Library - living style guide and reference

CREATE TABLE IF NOT EXISTS interaction_log (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    counter_value INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interaction_log_created_at ON interaction_log(created_at DESC);
CREATE INDEX idx_interaction_log_user ON interaction_log(user_email);

-- Note: Run this schema after creating the database:
-- CREATE DATABASE component_library_db;
-- \c component_library_db
-- \i games/component-library/database/schema.sql

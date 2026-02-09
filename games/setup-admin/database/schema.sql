-- Setup Admin Database Schema
-- Minimal schema - most data comes from activity_hub

-- Audit log for admin actions (optional future feature)
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    admin_email VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,  -- 'user_role_change', 'app_toggle', 'app_update'
    target_id VARCHAR(100) NOT NULL,   -- user email or app id
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying audit logs
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- Grant permissions
-- (Will be granted to activityhub user during setup)

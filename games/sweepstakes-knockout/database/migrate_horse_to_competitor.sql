-- Migration: Rename "horse" to "competitor" throughout database
-- Run this migration on existing databases to complete the terminology change

-- Rename horses table to competitors
ALTER TABLE horses RENAME TO competitors;

-- Rename horse_id column in event_participants
ALTER TABLE event_participants RENAME COLUMN horse_id TO competitor_id;

-- Rename horse_id column in results
ALTER TABLE results RENAME COLUMN horse_id TO competitor_id;

-- Update index names (if they exist with specific names)
-- Note: PostgreSQL auto-renames indexes when you rename tables/columns in most cases,
-- but we'll be explicit for clarity

-- The foreign key constraints will automatically update with the column renames
-- No need to drop and recreate them

-- Verify the changes
SELECT 'Migration complete. Verify with:' AS status;
SELECT '\dt' AS command, 'Should show "competitors" table' AS description;
SELECT '\d event_participants' AS command, 'Should show competitor_id column' AS description;
SELECT '\d results' AS command, 'Should show competitor_id column' AS description;

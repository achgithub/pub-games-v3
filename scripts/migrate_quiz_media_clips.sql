-- Migration: Add media_clips table, deduplication, and clip FKs on questions
-- Run against quiz_db:
--   psql -U activityhub -h localhost -p 5555 -d quiz_db -f scripts/migrate_quiz_media_clips.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- media_files: add guid, content_hash, label
ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS guid         UUID    NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS label        VARCHAR(255);

UPDATE media_files SET label = original_name WHERE label IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_files_content_hash ON media_files(content_hash)
  WHERE content_hash IS NOT NULL;

-- media_clips table
CREATE TABLE IF NOT EXISTS media_clips (
  id                 SERIAL PRIMARY KEY,
  guid               UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  media_file_id      INTEGER      NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  label              VARCHAR(255) NOT NULL,
  audio_start_sec    FLOAT        DEFAULT 0,
  audio_duration_sec FLOAT,
  created_at         TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_clips_media_file_id ON media_clips(media_file_id);
CREATE INDEX IF NOT EXISTS idx_media_clips_guid          ON media_clips(guid);

-- Back-fill default clip for every existing media_file
INSERT INTO media_clips (media_file_id, label, audio_start_sec, audio_duration_sec)
SELECT id, COALESCE(label, original_name), 0, NULL
FROM   media_files
WHERE  id NOT IN (SELECT DISTINCT media_file_id FROM media_clips);

-- questions: add guid, requires_media, clip FKs
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS guid           UUID    NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS requires_media BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image_clip_id  INTEGER REFERENCES media_clips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audio_clip_id  INTEGER REFERENCES media_clips(id) ON DELETE SET NULL;

-- Back-fill clip FKs from existing image_id/audio_id
UPDATE questions q SET image_clip_id = mc.id
FROM media_clips mc WHERE q.image_id IS NOT NULL
  AND mc.media_file_id = q.image_id AND q.image_clip_id IS NULL;

UPDATE questions q SET audio_clip_id = mc.id
FROM media_clips mc WHERE q.audio_id IS NOT NULL
  AND mc.media_file_id = q.audio_id AND q.audio_clip_id IS NULL;

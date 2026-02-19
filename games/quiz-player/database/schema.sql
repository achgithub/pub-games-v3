-- quiz_db schema
-- Shared by all quiz apps: game-admin, quiz-player, quiz-master, quiz-display

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Media assets (images + audio)
CREATE TABLE IF NOT EXISTS media_files (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  type          VARCHAR(10)  NOT NULL CHECK (type IN ('image', 'audio')),
  file_path     VARCHAR(500) NOT NULL,
  size_bytes    BIGINT,
  guid          UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  content_hash  VARCHAR(64),
  label         VARCHAR(255),
  created_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_files_content_hash ON media_files(content_hash)
  WHERE content_hash IS NOT NULL;

-- Named clips referencing a media file (supports trimmed audio segments)
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

-- Question bank
CREATE TABLE IF NOT EXISTS questions (
  id             SERIAL PRIMARY KEY,
  guid           UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  text           TEXT         NOT NULL,
  answer         TEXT         NOT NULL,
  category       VARCHAR(100),
  difficulty     VARCHAR(20)  DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  type           VARCHAR(20)  NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'picture', 'music')),
  image_id       INTEGER      REFERENCES media_files(id) ON DELETE SET NULL,
  audio_id       INTEGER      REFERENCES media_files(id) ON DELETE SET NULL,
  image_clip_id  INTEGER      REFERENCES media_clips(id) ON DELETE SET NULL,
  audio_clip_id  INTEGER      REFERENCES media_clips(id) ON DELETE SET NULL,
  requires_media BOOLEAN      NOT NULL DEFAULT FALSE,
  is_test_content BOOLEAN     DEFAULT FALSE,
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- Quiz packs (collections of rounds)
CREATE TABLE IF NOT EXISTS quiz_packs (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_by  VARCHAR(255),
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- Rounds within a pack
CREATE TABLE IF NOT EXISTS rounds (
  id                 SERIAL PRIMARY KEY,
  pack_id            INTEGER REFERENCES quiz_packs(id) ON DELETE CASCADE,
  round_number       INTEGER NOT NULL,
  name               VARCHAR(255) NOT NULL,
  type               VARCHAR(20)  NOT NULL CHECK (type IN ('text', 'picture', 'music')),
  time_limit_seconds INTEGER,
  UNIQUE(pack_id, round_number)
);

-- Ordered questions within a round
CREATE TABLE IF NOT EXISTS round_questions (
  id          SERIAL PRIMARY KEY,
  round_id    INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  UNIQUE(round_id, position)
);

-- Live quiz sessions
CREATE TABLE IF NOT EXISTS sessions (
  id           SERIAL PRIMARY KEY,
  pack_id      INTEGER REFERENCES quiz_packs(id),
  name         VARCHAR(255) NOT NULL,
  mode         VARCHAR(20)  NOT NULL DEFAULT 'team' CHECK (mode IN ('team', 'individual')),
  status       VARCHAR(20)  NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'completed')),
  join_code    VARCHAR(10)  UNIQUE NOT NULL,
  created_by   VARCHAR(255),
  created_at   TIMESTAMP    DEFAULT NOW(),
  started_at   TIMESTAMP,
  completed_at TIMESTAMP
);

-- Teams (for team mode; auto-created 1:1 in individual mode)
CREATE TABLE IF NOT EXISTS teams (
  id         SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  join_code  VARCHAR(10),
  created_at TIMESTAMP    DEFAULT NOW()
);

-- Players in a session
CREATE TABLE IF NOT EXISTS session_players (
  id         SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  user_name  VARCHAR(255),
  team_id    INTEGER REFERENCES teams(id),
  joined_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, user_email)
);

-- Submitted answers
CREATE TABLE IF NOT EXISTS answers (
  id           SERIAL PRIMARY KEY,
  session_id   INTEGER REFERENCES sessions(id),
  round_id     INTEGER REFERENCES rounds(id),
  question_id  INTEGER REFERENCES questions(id),
  team_id      INTEGER REFERENCES teams(id),
  player_id    INTEGER REFERENCES session_players(id),
  answer_text  TEXT,
  is_correct   BOOLEAN,
  points       INTEGER   DEFAULT 0,
  submitted_at TIMESTAMP DEFAULT NOW(),
  marked_at    TIMESTAMP
);

-- Score push history (when QM reveals scores)
CREATE TABLE IF NOT EXISTS score_reveals (
  id         SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id),
  round_id   INTEGER REFERENCES rounds(id),
  revealed_at TIMESTAMP DEFAULT NOW()
);

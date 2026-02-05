-- Migration: Add multi-player challenge support
-- Date: 2026-02-05
-- Description: Adds fields to support 3+ player challenges while maintaining backwards compatibility

-- Add new columns for multi-player challenges
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS initiator_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS player_ids TEXT[],
  ADD COLUMN IF NOT EXISTS accepted TEXT[],
  ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 2;

-- Create index for efficient multi-player queries
CREATE INDEX IF NOT EXISTS idx_challenges_player_ids
  ON challenges USING GIN(player_ids);

-- Create index for initiator queries
CREATE INDEX IF NOT EXISTS idx_challenges_initiator_id
  ON challenges(initiator_id);

-- Update existing 2-player challenges to have min/max = 2
UPDATE challenges
SET min_players = 2, max_players = 2
WHERE min_players IS NULL OR max_players IS NULL;

-- Add comment explaining the schema
COMMENT ON COLUMN challenges.initiator_id IS 'User who started the challenge (multi-player)';
COMMENT ON COLUMN challenges.player_ids IS 'Array of all invited player IDs (multi-player)';
COMMENT ON COLUMN challenges.accepted IS 'Array of player IDs who have accepted (multi-player)';
COMMENT ON COLUMN challenges.min_players IS 'Minimum players required to start game';
COMMENT ON COLUMN challenges.max_players IS 'Maximum players allowed in game';
COMMENT ON COLUMN challenges.from_user IS 'Deprecated: use initiator_id for new challenges';
COMMENT ON COLUMN challenges.to_user IS 'Deprecated: use player_ids for new challenges';

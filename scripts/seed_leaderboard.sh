#!/bin/bash
# Seed leaderboard with sample game results

echo "Seeding leaderboard with sample game results..."

psql -U activityhub -h localhost -p 5555 -d leaderboard_db <<'EOF'

-- Clear existing results (optional)
TRUNCATE game_results;

-- Tic-Tac-Toe results (mix of wins/losses/draws)
INSERT INTO game_results (game_type, game_id, winner_id, winner_name, loser_id, loser_name, is_draw, score, duration, played_at) VALUES
  ('tic-tac-toe', 'ttt-001', 'alice@pub.local', 'Alice', 'bob@pub.local', 'Bob', false, '1-0', 45, NOW() - INTERVAL '2 days'),
  ('tic-tac-toe', 'ttt-002', 'bob@pub.local', 'Bob', 'charlie@pub.local', 'Charlie', false, '1-0', 52, NOW() - INTERVAL '2 days'),
  ('tic-tac-toe', 'ttt-003', 'alice@pub.local', 'Alice', 'charlie@pub.local', 'Charlie', false, '1-0', 38, NOW() - INTERVAL '1 day'),
  ('tic-tac-toe', 'ttt-004', 'alice@pub.local', 'Alice', 'bob@pub.local', 'Bob', true, '0-0', 67, NOW() - INTERVAL '1 day'),
  ('tic-tac-toe', 'ttt-005', 'charlie@pub.local', 'Charlie', 'alice@pub.local', 'Alice', false, '1-0', 41, NOW() - INTERVAL '1 day'),
  ('tic-tac-toe', 'ttt-006', 'bob@pub.local', 'Bob', 'alice@pub.local', 'Alice', false, '1-0', 55, NOW() - INTERVAL '12 hours'),
  ('tic-tac-toe', 'ttt-007', 'charlie@pub.local', 'Charlie', 'bob@pub.local', 'Bob', false, '1-0', 48, NOW() - INTERVAL '6 hours'),
  ('tic-tac-toe', 'ttt-008', 'alice@pub.local', 'Alice', 'dave@pub.local', 'Dave', false, '1-0', 36, NOW() - INTERVAL '4 hours'),
  ('tic-tac-toe', 'ttt-009', 'dave@pub.local', 'Dave', 'bob@pub.local', 'Bob', false, '1-0', 62, NOW() - INTERVAL '2 hours'),
  ('tic-tac-toe', 'ttt-010', 'charlie@pub.local', 'Charlie', 'dave@pub.local', 'Dave', false, '1-0', 44, NOW() - INTERVAL '1 hour');

-- Dots results (first-to-5 scoring)
INSERT INTO game_results (game_type, game_id, winner_id, winner_name, loser_id, loser_name, is_draw, score, duration, played_at) VALUES
  ('dots', 'dots-001', 'alice@pub.local', 'Alice', 'bob@pub.local', 'Bob', false, '5-3', 180, NOW() - INTERVAL '3 days'),
  ('dots', 'dots-002', 'bob@pub.local', 'Bob', 'charlie@pub.local', 'Charlie', false, '5-2', 165, NOW() - INTERVAL '3 days'),
  ('dots', 'dots-003', 'alice@pub.local', 'Alice', 'charlie@pub.local', 'Charlie', false, '5-4', 210, NOW() - INTERVAL '2 days'),
  ('dots', 'dots-004', 'charlie@pub.local', 'Charlie', 'alice@pub.local', 'Alice', false, '5-3', 195, NOW() - INTERVAL '2 days'),
  ('dots', 'dots-005', 'bob@pub.local', 'Bob', 'dave@pub.local', 'Dave', false, '5-1', 145, NOW() - INTERVAL '1 day'),
  ('dots', 'dots-006', 'alice@pub.local', 'Alice', 'dave@pub.local', 'Dave', false, '5-2', 158, NOW() - INTERVAL '1 day'),
  ('dots', 'dots-007', 'charlie@pub.local', 'Charlie', 'bob@pub.local', 'Bob', false, '5-4', 203, NOW() - INTERVAL '18 hours'),
  ('dots', 'dots-008', 'dave@pub.local', 'Dave', 'charlie@pub.local', 'Charlie', false, '5-3', 188, NOW() - INTERVAL '12 hours'),
  ('dots', 'dots-009', 'alice@pub.local', 'Alice', 'bob@pub.local', 'Bob', false, '5-1', 142, NOW() - INTERVAL '8 hours'),
  ('dots', 'dots-010', 'bob@pub.local', 'Bob', 'alice@pub.local', 'Alice', false, '5-4', 197, NOW() - INTERVAL '4 hours'),
  ('dots', 'dots-011', 'charlie@pub.local', 'Charlie', 'dave@pub.local', 'Dave', false, '5-2', 171, NOW() - INTERVAL '2 hours'),
  ('dots', 'dots-012', 'alice@pub.local', 'Alice', 'charlie@pub.local', 'Charlie', false, '5-3', 186, NOW() - INTERVAL '30 minutes');

EOF

echo ""
echo "✅ Seeded leaderboard with sample results"
echo ""
echo "Results:"
echo "  - 10 Tic-Tac-Toe games (Alice: 3W-1D-2L, Bob: 3W-1D-3L, Charlie: 3W-0D-4L, Dave: 1W-0D-2L)"
echo "  - 12 Dots games (Alice: 5W-0L, Bob: 3W-4L, Charlie: 4W-4L, Dave: 1W-2L)"
echo ""
echo "View at: http://pi:5030/"

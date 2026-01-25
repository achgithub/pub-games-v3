#!/bin/bash

# Tic-Tac-Toe Basic Game Test
# Tests: game creation, moves, win detection, stats
# Run on Pi with backend running on port 4001

set -e

BASE_URL="${BASE_URL:-http://localhost:4001}"

echo "🎮 Tic-Tac-Toe Basic Game Test"
echo "=============================="
echo "Server: $BASE_URL"
echo ""

# Health check
echo "1. Health check..."
curl -s "$BASE_URL/api/health" | jq .
sleep 1

# Create game
echo ""
echo "2. Creating game (Alice vs Bob, first-to-1)..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/game" \
  -H "Content-Type: application/json" \
  -d '{"player1Id":100,"player1Name":"TestAlice","player2Id":101,"player2Name":"TestBob","mode":"normal","firstTo":1}')
echo "$RESPONSE" | jq .
GAME_ID=$(echo "$RESPONSE" | jq -r '.gameId')
echo "Game ID: $GAME_ID"
sleep 1

# Play moves - Alice wins with top row (positions 0, 1, 2)
echo ""
echo "3. Playing moves..."

echo "   Alice plays position 0 (top-left)..."
curl -s -X POST "$BASE_URL/api/move" \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"$GAME_ID\",\"playerId\":100,\"position\":0}" | jq '{board, currentTurn, status}'
sleep 1

echo "   Bob plays position 3 (middle-left)..."
curl -s -X POST "$BASE_URL/api/move" \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"$GAME_ID\",\"playerId\":101,\"position\":3}" | jq '{board, currentTurn, status}'
sleep 1

echo "   Alice plays position 1 (top-middle)..."
curl -s -X POST "$BASE_URL/api/move" \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"$GAME_ID\",\"playerId\":100,\"position\":1}" | jq '{board, currentTurn, status}'
sleep 1

echo "   Bob plays position 4 (center)..."
curl -s -X POST "$BASE_URL/api/move" \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"$GAME_ID\",\"playerId\":101,\"position\":4}" | jq '{board, currentTurn, status}'
sleep 1

echo "   Alice plays position 2 (top-right) - should WIN..."
RESULT=$(curl -s -X POST "$BASE_URL/api/move" \
  -H "Content-Type: application/json" \
  -d "{\"gameId\":\"$GAME_ID\",\"playerId\":100,\"position\":2}")
echo "$RESULT" | jq '{board: .game.board, status: .game.status, winnerId: .game.winnerId, gameEnded, message}'
sleep 1

# Check stats
echo ""
echo "4. Checking player stats..."
echo "   Alice (100):"
curl -s "$BASE_URL/api/stats/100" | jq .
echo "   Bob (101):"
curl -s "$BASE_URL/api/stats/101" | jq .

echo ""
echo "=============================="
echo "✅ Basic game test complete!"

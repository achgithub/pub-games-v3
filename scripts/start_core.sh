#!/bin/bash
# Start core services: identity-shell, setup-admin, game-admin, tic-tac-toe, dots, last-man-standing, lms-manager, sweepstakes, sweepstakes-knockout, quiz-player, quiz-master, quiz-display, mobile-test, component-library, leaderboard

# Check if tmux session exists
if tmux has-session -t core 2>/dev/null; then
    echo "tmux session 'core' already exists"
    echo "Run ./stop_core.sh first, or attach with: tmux attach -t core"
    exit 1
fi

echo "Starting core services..."

# Create new tmux session
tmux new-session -d -s core -n identity-shell

# Identity Shell (port 3001)
tmux send-keys -t core:identity-shell "cd ~/pub-games-v3/identity-shell/backend && go run *.go" C-m

# Setup Admin (port 5020)
tmux new-window -t core -n setup-admin
tmux send-keys -t core:setup-admin "cd ~/pub-games-v3/games/setup-admin/backend && go run *.go" C-m

# Game Admin (port 5070)
tmux new-window -t core -n game-admin
tmux send-keys -t core:game-admin "cd ~/pub-games-v3/games/game-admin/backend && go run *.go" C-m

# Tic-Tac-Toe (port 4001)
tmux new-window -t core -n tic-tac-toe
tmux send-keys -t core:tic-tac-toe "cd ~/pub-games-v3/games/tic-tac-toe/backend && go run *.go" C-m

# Dots (port 4011)
tmux new-window -t core -n dots
tmux send-keys -t core:dots "cd ~/pub-games-v3/games/dots/backend && go run *.go" C-m

# Last Man Standing (port 4021)
tmux new-window -t core -n last-man-standing
tmux send-keys -t core:last-man-standing "cd ~/pub-games-v3/games/last-man-standing/backend && go run *.go" C-m

# LMS Manager (port 4022)
tmux new-window -t core -n lms-manager
tmux send-keys -t core:lms-manager "cd ~/pub-games-v3/games/lms-manager/backend && go run *.go" C-m

# Sweepstakes (port 4031)
tmux new-window -t core -n sweepstakes
tmux send-keys -t core:sweepstakes "cd ~/pub-games-v3/games/sweepstakes/backend && go run *.go" C-m

# Sweepstakes Knockout (port 4032)
tmux new-window -t core -n sweepstakes-knockout
tmux send-keys -t core:sweepstakes-knockout "cd ~/pub-games-v3/games/sweepstakes-knockout/backend && go run *.go" C-m

# Quiz Player (port 4041)
tmux new-window -t core -n quiz-player
tmux send-keys -t core:quiz-player "cd ~/pub-games-v3/games/quiz-player/backend && go run *.go" C-m

# Quiz Master (port 5080)
tmux new-window -t core -n quiz-master
tmux send-keys -t core:quiz-master "cd ~/pub-games-v3/games/quiz-master/backend && go run *.go" C-m

# Quiz Display (port 5081)
tmux new-window -t core -n quiz-display
tmux send-keys -t core:quiz-display "cd ~/pub-games-v3/games/quiz-display/backend && go run *.go" C-m

# Mobile Test (port 4061)
tmux new-window -t core -n mobile-test
tmux send-keys -t core:mobile-test "cd ~/pub-games-v3/games/mobile-test/backend && go run *.go" C-m

# Component Library (port 5010)
tmux new-window -t core -n component-library
tmux send-keys -t core:component-library "cd ~/pub-games-v3/games/component-library/backend && go run *.go" C-m

# Leaderboard (port 5030)
tmux new-window -t core -n leaderboard
tmux send-keys -t core:leaderboard "cd ~/pub-games-v3/games/leaderboard/backend && go run *.go" C-m

echo "Core services starting in tmux session 'core'..."
echo "Waiting for services to be ready..."
echo ""

# Define core services to check [name:port]
declare -A SERVICES=(
    ["identity-shell"]="3001"
    ["setup-admin"]="5020"
    ["game-admin"]="5070"
    ["tic-tac-toe"]="4001"
    ["dots"]="4011"
    ["last-man-standing"]="4021"
    ["lms-manager"]="4022"
    ["sweepstakes"]="4031"
    ["sweepstakes-knockout"]="4032"
    ["quiz-player"]="4041"
    ["quiz-master"]="5080"
    ["quiz-display"]="5081"
    ["mobile-test"]="4061"
    ["component-library"]="5010"
    ["leaderboard"]="5030"
)

# Wait for services to start (max 30 seconds)
TIMEOUT=30
ELAPSED=0
ALL_READY=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    READY_COUNT=0
    for service in "${!SERVICES[@]}"; do
        port=${SERVICES[$service]}
        if lsof -i :$port >/dev/null 2>&1; then
            ((READY_COUNT++))
        fi
    done

    if [ $READY_COUNT -eq ${#SERVICES[@]} ]; then
        ALL_READY=1
        break
    fi

    sleep 2
    ((ELAPSED+=2))
    echo -ne "\rChecking... ($READY_COUNT/${#SERVICES[@]} ready, ${ELAPSED}s elapsed)"
done

echo ""
echo ""

if [ $ALL_READY -eq 1 ]; then
    echo "✅ All core services ready!"
else
    echo "⚠️  Some services not ready after ${TIMEOUT}s:"
    for service in "${!SERVICES[@]}"; do
        port=${SERVICES[$service]}
        if lsof -i :$port >/dev/null 2>&1; then
            echo "  ✓ $service (port $port)"
        else
            echo "  ✗ $service (port $port) - NOT READY"
        fi
    done
fi

echo ""
echo "Attach with: tmux attach -t core"
echo "Detach with: Ctrl+B then D"
echo "Navigate windows: Ctrl+B then N (next) or P (previous)"

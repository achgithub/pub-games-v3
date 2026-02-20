#!/bin/bash
# Start core services: identity-shell, setup-admin, game-admin, tic-tac-toe, dots, last-man-standing, sweepstakes, quiz-player, quiz-master, quiz-display, mobile-test, smoke-test

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

# Sweepstakes (port 4031)
tmux new-window -t core -n sweepstakes
tmux send-keys -t core:sweepstakes "cd ~/pub-games-v3/games/sweepstakes/backend && go run *.go" C-m

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

# Smoke Test (port 5010)
tmux new-window -t core -n smoke-test
tmux send-keys -t core:smoke-test "cd ~/pub-games-v3/games/smoke-test/backend && go run *.go" C-m

echo "Core services started in tmux session 'core'"
echo ""
echo "Attach with: tmux attach -t core"
echo "Detach with: Ctrl+B then D"
echo "Navigate windows: Ctrl+B then N (next) or P (previous)"
echo ""
echo "Check status with: ./status_core.sh"

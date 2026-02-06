#!/bin/bash
# Start all PubGames services in tmux

# Check if tmux session exists
if tmux has-session -t pubgames 2>/dev/null; then
    echo "❌ tmux session 'pubgames' already exists"
    echo "Run ./stop_services.sh first, or attach with: tmux attach -t pubgames"
    exit 1
fi

echo "🚀 Starting PubGames services..."

# Create new tmux session
tmux new-session -d -s pubgames -n identity-shell

# Identity Shell (port 3001)
tmux send-keys -t pubgames:identity-shell "cd ~/pub-games-v3/identity-shell/backend && go run *.go" C-m

# Tic-Tac-Toe (port 4001)
tmux new-window -t pubgames -n tic-tac-toe
tmux send-keys -t pubgames:tic-tac-toe "cd ~/pub-games-v3/games/tic-tac-toe/backend && go run *.go" C-m

# Dots (port 4011)
tmux new-window -t pubgames -n dots
tmux send-keys -t pubgames:dots "cd ~/pub-games-v3/games/dots/backend && go run *.go" C-m

# Sweepstakes (port 4031)
tmux new-window -t pubgames -n sweepstakes
tmux send-keys -t pubgames:sweepstakes "cd ~/pub-games-v3/games/sweepstakes/backend && go run *.go" C-m

# Spoof (port 4051) - NEW MULTI-PLAYER GAME
tmux new-window -t pubgames -n spoof
tmux send-keys -t pubgames:spoof "cd ~/pub-games-v3/games/spoof/backend && go run *.go" C-m

# Smoke Test (port 5010)
tmux new-window -t pubgames -n smoke-test
tmux send-keys -t pubgames:smoke-test "cd ~/pub-games-v3/games/smoke-test/backend && go run *.go" C-m

# Leaderboard (port 5030)
tmux new-window -t pubgames -n leaderboard
tmux send-keys -t pubgames:leaderboard "cd ~/pub-games-v3/games/leaderboard/backend && go run *.go" C-m

# Season Scheduler (port 5040)
tmux new-window -t pubgames -n season-scheduler
tmux send-keys -t pubgames:season-scheduler "cd ~/pub-games-v3/games/season-scheduler/backend && go run *.go" C-m

# Display Admin (port 5050)
tmux new-window -t pubgames -n display-admin
tmux send-keys -t pubgames:display-admin "cd ~/pub-games-v3/games/display-admin/backend && go run *.go" C-m

# Display Runtime (port 5051)
tmux new-window -t pubgames -n display-runtime
tmux send-keys -t pubgames:display-runtime "cd ~/pub-games-v3/games/display-runtime/backend && go run *.go" C-m

echo "✅ All services started in tmux session 'pubgames'"
echo ""
echo "Attach with: tmux attach -t pubgames"
echo "Detach with: Ctrl+B then D"
echo "Navigate windows: Ctrl+B then N (next) or P (previous)"
echo "List windows: Ctrl+B then W"
echo ""
echo "Check status with: ./status_services.sh"

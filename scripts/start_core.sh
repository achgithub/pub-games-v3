#!/bin/bash
# Start core services: identity-shell, setup-admin, game-admin, last-man-standing

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

# Last Man Standing (port 4021)
tmux new-window -t core -n last-man-standing
tmux send-keys -t core:last-man-standing "cd ~/pub-games-v3/games/last-man-standing/backend && go run *.go" C-m

echo "Core services started in tmux session 'core'"
echo ""
echo "Attach with: tmux attach -t core"
echo "Detach with: Ctrl+B then D"
echo "Navigate windows: Ctrl+B then N (next) or P (previous)"
echo ""
echo "Check status with: ./status_core.sh"

#!/bin/bash
# Stop all PubGames services

# Check if tmux session exists
if ! tmux has-session -t pubgames 2>/dev/null; then
    echo "❌ No tmux session 'pubgames' found"
    exit 1
fi

echo "🛑 Stopping PubGames services..."

# Kill the entire tmux session
tmux kill-session -t pubgames

echo "✅ All services stopped"
echo ""
echo "To start again: ./start_services.sh"

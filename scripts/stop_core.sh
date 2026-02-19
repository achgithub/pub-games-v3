#!/bin/bash
# Stop core services

if ! tmux has-session -t core 2>/dev/null; then
    echo "No tmux session 'core' found"
    exit 1
fi

echo "Stopping core services..."

tmux kill-session -t core

echo "Core services stopped"
echo ""
echo "To start again: ./start_core.sh"

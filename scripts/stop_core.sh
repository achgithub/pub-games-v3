#!/bin/bash
# Stop core services - robust version

echo "Stopping core services..."

# Define all ports used by core services
PORTS=(3001 4001 4011 4021 4022 4031 4032 4041 4051 4061 5010 5020 5030 5040 5070 5080 5081)

# Step 1: Kill tmux session if it exists
if tmux has-session -t core 2>/dev/null; then
    echo "Killing tmux session 'core'..."
    tmux kill-session -t core
    sleep 2
else
    echo "No tmux session 'core' found"
fi

# Step 2: Find and kill any remaining processes on core ports
echo "Checking for remaining processes on core ports..."
for port in "${PORTS[@]}"; do
    PID=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "  Port $port still in use by PID $PID - killing..."
        kill -9 $PID 2>/dev/null
    fi
done

# Step 3: Verify all ports are clear
sleep 1
STILL_RUNNING=0
for port in "${PORTS[@]}"; do
    PID=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "  WARNING: Port $port still in use by PID $PID"
        STILL_RUNNING=1
    fi
done

if [ $STILL_RUNNING -eq 0 ]; then
    echo "✅ All core services stopped successfully"
else
    echo "⚠️  Some processes may still be running. Check manually with: lsof -i"
    exit 1
fi

echo ""
echo "To start again: ./start_core.sh"

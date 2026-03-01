#!/bin/bash
# Check status of core services

echo "Core Service Status"
echo "==================="
echo ""

# Check tmux session
if tmux has-session -t core 2>/dev/null; then
    echo "tmux session 'core' is running"
    echo ""
    echo "Windows:"
    tmux list-windows -t core
    echo ""
else
    echo "tmux session 'core' is NOT running"
    echo ""
fi

# Check ports
echo "Port Status:"
echo "------------"

check_port() {
    local port=$1
    local service=$2
    if lsof -i :$port > /dev/null 2>&1; then
        echo "  UP   Port $port - $service"
    else
        echo "  DOWN Port $port - $service"
    fi
}

check_port 3001 "Identity Shell"
check_port 5020 "Setup Admin"
check_port 5070 "Game Admin"
check_port 4001 "Tic-Tac-Toe"
check_port 4011 "Dots"
check_port 4021 "Last Man Standing"
check_port 4022 "LMS Manager"
check_port 4031 "Sweepstakes"
check_port 4032 "Sweepstakes Knockout"
check_port 4041 "Quiz Player"
check_port 5080 "Quiz Master"
check_port 5081 "Quiz Display"
check_port 4061 "Mobile Test"
check_port 5010 "Component Library"
check_port 5030 "Leaderboard"

echo ""
echo "Database Status:"
echo "----------------"
check_port 5555 "PostgreSQL"

echo ""
echo "To view logs: tmux attach -t core"
echo "To restart:   ./stop_core.sh && ./start_core.sh"

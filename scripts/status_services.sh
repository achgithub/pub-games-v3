#!/bin/bash
# Check status of all PubGames services

echo "🔍 PubGames Service Status"
echo "=========================="
echo ""

# Check tmux session
if tmux has-session -t pubgames 2>/dev/null; then
    echo "✅ tmux session 'pubgames' is running"
    echo ""
    echo "Windows:"
    tmux list-windows -t pubgames
    echo ""
else
    echo "❌ tmux session 'pubgames' is NOT running"
    echo ""
fi

# Check ports
echo "Port Status:"
echo "------------"

check_port() {
    local port=$1
    local service=$2
    if lsof -i :$port > /dev/null 2>&1; then
        echo "✅ Port $port - $service"
    else
        echo "❌ Port $port - $service (not running)"
    fi
}

check_port 3001 "Identity Shell"
check_port 4001 "Tic-Tac-Toe"
check_port 4011 "Dots"
check_port 4031 "Sweepstakes"
check_port 4051 "Spoof (NEW)"
check_port 5010 "Smoke Test"
check_port 5030 "Leaderboard"
check_port 5040 "Season Scheduler"
check_port 5050 "Display Admin"
check_port 5051 "Display Runtime"

echo ""
echo "Database Status:"
echo "----------------"
check_port 5555 "PostgreSQL"
check_port 6379 "Redis"

echo ""
echo "To view logs: tmux attach -t pubgames"
echo "To restart: ./stop_services.sh && ./start_services.sh"

# Pub Games v3 - Project Configuration

## Overview
Multi-app platform for pub-based games and activities. Microservices architecture with each mini-app owning its own data.

## Architecture

### Service Structure
- **Identity Shell** - Core identity service, hosts mini-apps
- **Mini-apps** - Independent games/activities (tic-tac-toe, quizzes, etc.)
- Each mini-app has its own database - enables independent deployments

### Database Architecture

**PostgreSQL** - System of record, persistent data:
- User accounts/identity
- Quiz content (questions, media references)
- Game history and results (after game ends)
- Persistent leaderboards (all-time stats)
- Configuration and templates

**Redis** - Live/ephemeral data:
- Real-time game state (tic-tac-toe board, active turns)
- Live leaderboards during quiz (sorted sets)
- Answer submission bursts (30+ writes in seconds)
- Active session state (current question, timer, who's answered)
- Pub/sub for instant updates (player made a move, scores updated)

**Simple rule:** If it's live and ephemeral, Redis. If it needs to survive a restart, PostgreSQL.

### Game Patterns

| Game Type | Speed | Primary DB | Notes |
|-----------|-------|------------|-------|
| Tic-tac-toe | Fast, real-time | Redis | Hash for board state, pub/sub for moves |
| Quiz (30+ players) | Burst writes | Redis + PostgreSQL | Redis for live leaderboard/answers, PostgreSQL for questions |
| Slow turn-based | Slow | PostgreSQL | Redis optional |

### Future: Cross-Pub Federation
- Central cloud instance (PostgreSQL + Redis on VPS)
- Pi becomes a client of cloud services for federated features
- Pi remains self-sufficient for local play (works offline)
- Local-first: build everything to work on single Pi, federation bolts on later

## Deployment
- **Mac**: Code editing, Git operations, Claude Code
- **Pi**: Go builds, npm, PostgreSQL, Redis, running services
- See global CLAUDE.md for workflow details

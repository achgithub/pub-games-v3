# Changelog

All notable changes to activity-hub-common will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure and Go module
- **auth** package: Authentication middleware, user context, admin authorization
  - `Middleware()` - HTTP auth middleware for Bearer tokens
  - `SSEMiddleware()` - SSE auth middleware using query parameters
  - `AdminMiddleware()` - Admin authorization middleware
  - `GetUserFromContext()` - Extract user from request context
  - `AuthUser` type with email, name, and admin flag
- **database** package: PostgreSQL connection pooling and helpers
  - `InitDatabase()` - Initialize app-specific database connection
  - `InitIdentityDatabase()` - Initialize shared identity database
  - `ScanNullString()` - Helper for NULL string handling
- **redis** package: Redis client and pub/sub operations
  - `InitRedis()` - Initialize Redis client
  - `CreateGame()`, `GetGame()`, `UpdateGame()`, `DeleteGame()` - Game CRUD
  - `PublishEvent()` - Publish to Redis channel
  - `Subscribe()` - Subscribe to Redis channel
- **sse** package: Server-Sent Events streaming
  - `HandleStream()` - SSE stream handler with Redis integration
  - `Event` type and `FormatSSE()` formatter
  - `StreamConfig` for stream configuration
- **http** package: HTTP utilities and middleware
  - `SuccessJSON()`, `ErrorJSON()` - JSON response helpers
  - `ParseJSON()` - Parse JSON request body
  - `CORSMiddleware()` - CORS headers middleware
  - `LoggingMiddleware()` - Request logging middleware
- **logging** package: Structured logging
  - `Logger` type with Info, Error, Warn, Debug, Success methods
  - `New()` - Create logger for app
- **config** package: Environment variable helpers
  - `GetEnv()` - Get env var with default
  - `RequireEnv()` - Get required env var or panic

### Documentation
- README.md with usage examples and versioning guide
- Package-level godoc comments
- Integration test scaffolding

## [0.1.0] - 2026-02-08

### Added
- Initial scaffolding and package structure
- Go module initialization
- Basic test coverage for all packages

## Notes

### Migration Strategy
Apps will migrate to this library incrementally:
1. Phase 2: Scaffolding (COMPLETE)
2. Phase 3: Implementation (IN PROGRESS)
3. Phase 4: Pilot migration (tic-tac-toe)
4. Phase 5: Database-driven app registry
5. Phase 6: Production security (JWT)
6. Phase 7: Mass migration (all apps)

### Breaking Changes Policy
- Major versions (v1 → v2) may have breaking changes
- Minor versions (v1.0 → v1.1) are backward compatible
- Patch versions (v1.0.0 → v1.0.1) are bug fixes only

### Development Workflow
During development, apps use local replace directive:
```go
replace github.com/yourusername/activity-hub-common => ../../lib/activity-hub-common
```

After publishing to GitHub, apps import directly:
```go
require github.com/yourusername/activity-hub-common v1.0.0
```

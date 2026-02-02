# CRITICAL SECURITY ISSUES

**⚠️ IMPORTANT: This system is NOT production-ready for untrusted networks ⚠️**

## Current Status: INSECURE

### Summary
The authentication system generates JWT tokens but **DOES NOT VALIDATE THEM**. This creates multiple security vulnerabilities that allow:
- User impersonation
- Admin privilege escalation
- Unauthorized data access
- API access without authentication

### Critical Vulnerabilities

#### 1. URL Parameter Authentication (INSECURE)
**Status:** 🔴 VULNERABLE

**What happens:**
- Apps receive user identity via URL parameters: `?userId=alice@test.com&userName=Alice&isAdmin=true`
- Apps trust these parameters without validation
- No backend verification of user identity

**Attack vectors:**
- Manually edit URL to impersonate any user
- Change `userId=alice@test.com` to `userId=bob@test.com` → See/modify Bob's data
- Add `isAdmin=true` to URL → Gain admin privileges
- Direct API calls with curl (no authentication needed)

**Example exploit:**
```bash
# Impersonate admin without logging in
curl -X POST http://192.168.1.45:4031/api/competitions \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacked Competition","type":"race","status":"draft"}'

# No token required, no validation performed
```

#### 2. JWT Token Generation Without Validation
**Status:** 🔴 NOT IMPLEMENTED

**What exists:**
- Identity shell generates JWT token: `demo-token-{email}`
- Token returned to frontend after login
- Token stored in browser

**What's missing:**
- ❌ Apps don't send token with API requests
- ❌ Backends don't validate tokens
- ❌ No middleware to extract user from token
- ❌ No permission checks on admin operations

**Current flow (broken):**
```
User → Login (gets token) → [Token ignored] → Apps use URL params → Backend trusts everything
```

**Intended flow (not implemented):**
```
User → Login (gets token) → Token in every request → Backend validates token → Backend checks permissions
```

#### 3. Admin Privilege Escalation
**Status:** 🔴 TRIVIAL TO EXPLOIT

**How to become admin:**
1. Open any app in browser
2. Manually add `&isAdmin=true` to URL
3. Admin UI appears
4. All admin API calls work

**Example:**
```
# Regular user URL
http://192.168.1.45:4031/?userId=user@test.com&userName=User

# Manually edit to:
http://192.168.1.45:4031/?userId=user@test.com&userName=User&isAdmin=true

# Now has full admin access
```

**Affected services:**
- Sweepstakes (create/delete competitions, manage entries)
- Season Scheduler (create/edit seasons, manage schedules)
- Any future admin features

#### 4. Direct API Access Without Authentication
**Status:** 🔴 VULNERABLE

**Attack:**
- All API endpoints accept requests without authentication
- No CORS restrictions on local network
- Any tool (curl, Postman, scripts) can call APIs directly

**Example attacks:**
```bash
# Create competition as any user
curl -X POST http://192.168.1.45:4031/api/competitions \
  -H "Content-Type: application/json" \
  -d '{"name":"Fake","type":"knockout","status":"open"}'

# Pick blind box as any user
curl -X POST http://192.168.1.45:4031/api/competitions/1/choose-blind-box \
  -H "Content-Type: application/json" \
  -d '{"user_id":"victim@test.com","box_number":5}'

# Delete entries
curl -X DELETE http://192.168.1.45:4031/api/entries/123
```

## Why This Happened

**Design vs Implementation Gap:**

The architecture documents specify proper JWT authentication, but implementation was never completed:

1. ✅ **Designed:** Token-based authentication with validation
2. ✅ **Implemented:** Token generation (identity-shell/backend/main.go:115-162)
3. ❌ **Missing:** Token validation in all app backends
4. ❌ **Missing:** Token transmission from frontends to backends
5. ❌ **Missing:** Middleware to extract/validate user from token
6. ❌ **Missing:** Permission checks on admin operations

**Development path:**
- V2 → V3 migration focused on architecture changes (single port, iframe embedding)
- Authentication mechanism was ported but not fully integrated
- URL parameters used for quick development
- Token validation "TODO" was never completed

## Risk Assessment

### For Current Deployment (Local Pub Network)

**Threat Level:** 🟡 MEDIUM
- Network is private (192.168.1.x)
- Users are physically present and trusted (friends at pub)
- No internet exposure
- Limited motivation for malicious behavior

**Acceptable if:**
- Users are trusted friends
- System is not accessible from internet
- You accept that anyone can cheat/impersonate
- Data is not sensitive or valuable

### For Internet-Facing Deployment

**Threat Level:** 🔴 CRITICAL
- **DO NOT expose this system to the internet**
- Trivial to exploit from anywhere
- No accountability (can impersonate any user)
- Admin operations unprotected
- Database can be completely compromised

## Required Fixes

### Phase 1: Backend Token Validation (REQUIRED for security)

**Estimated effort:** 2-3 hours

**Tasks:**
1. Add authentication middleware to all app backends
2. Extract JWT token from Authorization header
3. Validate token and query user from database
4. Store authenticated user in request context
5. Use authenticated user (not request body) for operations
6. Add admin check middleware for admin-only endpoints

**Affected services:**
- Identity Shell (already generates tokens)
- Tic-Tac-Toe
- Dots & Boxes
- Sweepstakes ⚠️ (has admin features)
- Season Scheduler ⚠️ (has admin features)
- Leaderboard
- Smoke Test (for consistency)

### Phase 2: Frontend Token Transmission (REQUIRED for security)

**Estimated effort:** 1-2 hours

**Tasks:**
1. Store token in localStorage after login
2. Add Authorization header to all axios requests
3. Handle 401 responses (redirect to login)
4. Remove reliance on URL parameters for auth

**Affected services:**
- All frontend apps (7 apps)

### Phase 3: Permission Layer (RECOMMENDED)

**Estimated effort:** 2-3 hours

**Tasks:**
1. Define permission model (roles, capabilities)
2. Store permissions in database
3. Check permissions on sensitive operations
4. Audit log for admin actions

## Implementation Priority

**If keeping local-only (private network):**
- Phase 1 & 2: Optional (trust users)
- Phase 3: Not needed

**If internet exposure planned:**
- Phase 1 & 2: **CRITICAL - MUST DO BEFORE EXPOSING**
- Phase 3: Recommended

**If sensitive data (money, personal info):**
- Phase 1 & 2: **REQUIRED IMMEDIATELY**
- Phase 3: **REQUIRED**

## Temporary Mitigations

Until proper auth is implemented:

1. **Network isolation** - Keep on private network only
2. **User education** - Trust users not to abuse the system
3. **Monitoring** - Watch logs for suspicious activity
4. **Backups** - Regular database backups in case of tampering
5. **Firewall** - Block external access to ports 3001, 4000-5999

## Code Examples

See `docs/reference/AUTHENTICATION-FIX.md` for:
- Complete authentication middleware code
- Frontend token management patterns
- Step-by-step implementation guide
- Testing procedures

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design (describes intended auth)
- [FRONTEND.md](./FRONTEND.md) - URL parameters (current insecure method)
- [TODO.md](../TODO.md) - Implementation roadmap

## History

- **2026-02-02** - Vulnerability discovered during admin feature testing
- **2026-02-02** - This document created to track the issue

---

**Last Updated:** 2026-02-02
**Severity:** HIGH
**Status:** OPEN
**Owner:** TBD

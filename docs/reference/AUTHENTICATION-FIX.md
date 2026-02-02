# Authentication Implementation Guide

**Step-by-step guide to fix the authentication vulnerabilities documented in [SECURITY-CRITICAL.md](../SECURITY-CRITICAL.md)**

## Overview

Currently: JWT tokens generated but not validated
Goal: Validate tokens on every backend request

## Phase 1: Backend Token Validation

### Step 1: Create Authentication Middleware (Go)

Add this to each app's backend (e.g., `games/sweepstakes/backend/auth.go`):

```go
package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strings"
)

// User represents an authenticated user
type AuthUser struct {
	Email   string
	Name    string
	IsAdmin bool
}

// Context key for storing authenticated user
type contextKey string

const userContextKey = contextKey("user")

// requireAuth middleware validates JWT token and extracts user
func requireAuth(db *sql.DB) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Missing authorization token", http.StatusUnauthorized)
				return
			}

			// Validate Bearer format
			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "Invalid authorization format", http.StatusUnauthorized)
				return
			}

			// Extract token (format: "Bearer demo-token-{email}")
			token := strings.TrimPrefix(authHeader, "Bearer ")
			if !strings.HasPrefix(token, "demo-token-") {
				http.Error(w, "Invalid token format", http.StatusUnauthorized)
				return
			}

			// Extract email from token
			email := strings.TrimPrefix(token, "demo-token-")

			// Query user from identity database
			var user AuthUser
			err := db.QueryRow(`
				SELECT email, name, is_admin
				FROM users
				WHERE email = $1
			`, email).Scan(&user.Email, &user.Name, &user.IsAdmin)

			if err == sql.ErrNoRows {
				http.Error(w, "User not found", http.StatusUnauthorized)
				return
			} else if err != nil {
				log.Printf("Database error during auth: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}

			// Store user in request context
			ctx := context.WithValue(r.Context(), userContextKey, user)
			next(w, r.WithContext(ctx))
		}
	}
}

// requireAdmin middleware checks if user is admin
func requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r)
		if user == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !user.IsAdmin {
			http.Error(w, "Admin access required", http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// getUserFromContext extracts authenticated user from request context
func getUserFromContext(r *http.Request) *AuthUser {
	user, ok := r.Context().Value(userContextKey).(AuthUser)
	if !ok {
		return nil
	}
	return &user
}
```

### Step 2: Connect to Identity Database

Each app needs access to the identity database to validate users:

```go
// In main.go, add identity database connection
var identityDB *sql.DB

func main() {
	// Existing app database connection
	appDB, err := sql.Open("postgres", appConnStr)
	// ... error handling ...

	// NEW: Connect to identity database
	identityConnStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getEnv("DB_HOST", "127.0.0.1"),
		getEnv("DB_PORT", "5555"),
		getEnv("DB_USER", "pubgames"),
		getEnv("DB_PASS", "pubgames"),
		"pubgames", // Identity database name
	)

	identityDB, err = sql.Open("postgres", identityConnStr)
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()

	if err := identityDB.Ping(); err != nil {
		log.Fatal("Failed to ping identity database:", err)
	}

	log.Println("✅ Connected to identity database")

	// ... rest of setup ...
}
```

### Step 3: Apply Middleware to Endpoints

```go
func main() {
	// ... database setup ...

	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()

	// Create auth middleware instance with identity database
	auth := requireAuth(identityDB)

	// Apply to ALL API endpoints
	api.HandleFunc("/competitions",
		auth(handleGetCompetitions)).Methods("GET")

	// Admin-only endpoints - chain both middlewares
	api.HandleFunc("/competitions",
		auth(requireAdmin(handleCreateCompetition))).Methods("POST")

	api.HandleFunc("/competitions/{id}",
		auth(requireAdmin(handleUpdateCompetition))).Methods("PUT")

	api.HandleFunc("/entries/{id}",
		auth(requireAdmin(handleDeleteEntry))).Methods("DELETE")

	// User endpoints - auth only (no admin required)
	api.HandleFunc("/competitions/{id}/choose-blind-box",
		auth(handleChooseBlindBox)).Methods("POST")

	api.HandleFunc("/draws",
		auth(handleGetDraws)).Methods("GET")

	// ... rest of routes ...
}
```

### Step 4: Use Authenticated User in Handlers

**Before (insecure):**
```go
func handleChooseBlindBox(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID    string `json:"user_id"`    // ❌ Trusts request body
		BoxNumber int    `json:"box_number"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Use req.UserID - attacker could set this to anyone!
	createDraw(req.UserID, req.BoxNumber)
}
```

**After (secure):**
```go
func handleChooseBlindBox(w http.ResponseWriter, r *http.Request) {
	// ✅ Get REAL authenticated user from context
	user := getUserFromContext(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		BoxNumber int `json:"box_number"`
		// No user_id in request - we get it from auth token
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Use user.Email from validated token
	createDraw(user.Email, req.BoxNumber)
}
```

## Phase 2: Frontend Token Transmission

### Step 1: Identity Shell - Store Token After Login

```typescript
// identity-shell/frontend/src/components/LoginView.tsx

const handleLogin = async (email: string, code: string) => {
  try {
    const response = await axios.post(`${API_BASE}/api/login`, {
      email,
      code,
    });

    if (response.data.success) {
      const { token, user } = response.data;

      // Store token in localStorage
      localStorage.setItem('authToken', token);

      // Set user in app state
      onLoginSuccess(user);
    }
  } catch (err) {
    // Handle error
  }
};
```

### Step 2: Identity Shell - Pass Token to Apps

**Option A: Via URL parameter (simpler)**

```typescript
// identity-shell/frontend/src/hooks/useApps.ts

export function buildAppUrl(
  app: AppDefinition,
  params: { userId?: string; userName?: string; isAdmin?: boolean; gameId?: string }
): string {
  if (!app.url) return '';

  let url = app.url.replace('{host}', window.location.hostname);

  // Get token from localStorage
  const token = localStorage.getItem('authToken');

  const searchParams = new URLSearchParams();
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.userName) searchParams.set('userName', params.userName);
  if (params.isAdmin !== undefined) searchParams.set('isAdmin', params.isAdmin.toString());
  if (params.gameId) searchParams.set('gameId', params.gameId);
  if (token) searchParams.set('token', token); // Add token to URL

  const queryString = searchParams.toString();
  if (queryString) {
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  return url;
}
```

**Option B: Via postMessage (more secure, more complex)**

Identity shell can send token to iframe after load:
```typescript
// After iframe loads
iframeRef.current?.contentWindow?.postMessage(
  { type: 'AUTH_TOKEN', token: localStorage.getItem('authToken') },
  '*'
);
```

App receives token:
```typescript
// In app, listen for token
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'AUTH_TOKEN') {
      setToken(event.data.token);
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Step 3: App Frontend - Extract and Store Token

```typescript
// games/sweepstakes/frontend/src/App.tsx

function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      userName: params.get('userName'),
      isAdmin: params.get('isAdmin') === 'true',
      token: params.get('token'), // Extract token from URL
      gameId: params.get('gameId'),
    };
  }, []);
}

function App() {
  const { userId, userName, isAdmin, token } = useQueryParams();

  // Store token for use in API calls
  const authToken = token || '';

  // ... rest of app ...
}
```

### Step 4: App Frontend - Send Token with Every Request

**Option A: Add to each request**

```typescript
const response = await axios.post(
  `${API_BASE}/api/competitions/${selectedComp.id}/choose-blind-box`,
  { box_number: boxNumber },
  {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  }
);
```

**Option B: Create axios instance with default headers (better)**

```typescript
// At top of App.tsx or separate file
const createAuthenticatedAxios = (token: string) => {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};

function App() {
  const { token } = useQueryParams();
  const api = useMemo(() => createAuthenticatedAxios(token || ''), [token]);

  // Now use api instead of axios
  const handleChooseBlindBox = async (boxNumber: number) => {
    const response = await api.post(
      `/api/competitions/${selectedComp.id}/choose-blind-box`,
      { box_number: boxNumber }
    );
    // ...
  };
}
```

### Step 5: Handle 401 Responses

```typescript
// Add axios interceptor to handle auth errors
useEffect(() => {
  const interceptor = api.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 401) {
        // Token invalid or expired - redirect to login
        alert('Session expired. Please login again.');
        window.location.href = `http://${window.location.hostname}:3001`;
      }
      return Promise.reject(error);
    }
  );

  return () => api.interceptors.response.eject(interceptor);
}, [api]);
```

## Testing Checklist

### Backend Tests

```bash
# Test: Missing token returns 401
curl -X POST http://localhost:4031/api/competitions \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","type":"race","status":"draft"}'
# Expected: 401 Unauthorized

# Test: Invalid token returns 401
curl -X POST http://localhost:4031/api/competitions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token" \
  -d '{"name":"Test","type":"race","status":"draft"}'
# Expected: 401 Unauthorized

# Test: Valid token for regular user returns 403 on admin endpoint
curl -X POST http://localhost:4031/api/competitions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-user@test.com" \
  -d '{"name":"Test","type":"race","status":"draft"}'
# Expected: 403 Forbidden

# Test: Valid admin token works
curl -X POST http://localhost:4031/api/competitions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-admin@test.com" \
  -d '{"name":"Test","type":"race","status":"draft"}'
# Expected: 200 OK
```

### Frontend Tests

1. **Login and verify token stored:**
   - Login as admin@test.com
   - Open DevTools → Application → Local Storage
   - Verify `authToken` exists

2. **Check token sent to app:**
   - Click on Sweepstakes
   - Check URL includes `&token=demo-token-admin@test.com`
   - Open DevTools → Network tab
   - Make an action (create competition)
   - Check request headers include `Authorization: Bearer demo-token-admin@test.com`

3. **Test URL manipulation has no effect:**
   - Manually change URL `&isAdmin=false` to `&isAdmin=true`
   - Try admin action
   - Should fail with 403 (backend checks real user from token, not URL)

4. **Test token expiry:**
   - Clear token from localStorage
   - Try to perform action
   - Should get 401 and redirect to login

## Rollout Strategy

### Stage 1: Add middleware to ONE app (test thoroughly)
1. Pick simplest app (Smoke Test)
2. Implement backend auth middleware
3. Update frontend to send token
4. Test all endpoints
5. Verify no regressions

### Stage 2: Roll out to remaining apps
1. Copy auth.go to each app backend
2. Update main.go to apply middleware
3. Update each frontend to send token
4. Test each app individually

### Stage 3: Remove debug code
1. Remove console.log debug statements
2. Remove URL parameter fallbacks
3. Remove comments about insecure previous version

## Alternative: Real JWT Validation

For production, replace `demo-token-{email}` with actual JWT:

```go
import "github.com/golang-jwt/jwt/v5"

var jwtSecret = []byte(getEnv("JWT_SECRET", "your-secret-key"))

func validateJWT(tokenString string) (*AuthUser, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	return &AuthUser{
		Email:   claims["email"].(string),
		Name:    claims["name"].(string),
		IsAdmin: claims["is_admin"].(bool),
	}, nil
}
```

## See Also

- [SECURITY-CRITICAL.md](../SECURITY-CRITICAL.md) - Vulnerability analysis
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [BACKEND.md](../BACKEND.md) - Backend patterns
- [FRONTEND.md](../FRONTEND.md) - Frontend patterns

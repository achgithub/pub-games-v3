package auth

// AuthUser represents an authenticated user
type AuthUser struct {
	Email   string
	Name    string
	IsAdmin bool
}

// Context key for storing authenticated user
type contextKey string

const userContextKey = contextKey("user")

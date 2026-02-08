package auth

import (
	"context"
	"testing"
)

func TestGetUserFromContext(t *testing.T) {
	// Test with user in context
	user := AuthUser{
		Email:   "test@example.com",
		Name:    "Test User",
		IsAdmin: false,
	}

	ctx := context.WithValue(context.Background(), userContextKey, user)
	retrieved, ok := GetUserFromContext(ctx)

	if !ok {
		t.Error("Expected to retrieve user from context")
	}

	if retrieved.Email != user.Email {
		t.Errorf("Expected email %s, got %s", user.Email, retrieved.Email)
	}

	// Test with empty context
	emptyCtx := context.Background()
	_, ok = GetUserFromContext(emptyCtx)

	if ok {
		t.Error("Expected no user in empty context")
	}
}

func TestAuthUser(t *testing.T) {
	user := AuthUser{
		Email:   "admin@test.com",
		Name:    "Admin User",
		IsAdmin: true,
	}

	if user.Email != "admin@test.com" {
		t.Errorf("Expected email admin@test.com, got %s", user.Email)
	}

	if !user.IsAdmin {
		t.Error("Expected user to be admin")
	}
}

// Integration tests (require PostgreSQL)
// Run with: go test -tags=integration ./...

// TODO: Add integration tests for Middleware
// TODO: Add integration tests for SSEMiddleware
// TODO: Add integration tests for AdminMiddleware

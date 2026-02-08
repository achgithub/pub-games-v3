package database

import (
	"database/sql"
	"testing"
)

func TestScanNullString(t *testing.T) {
	// Test with valid string
	validStr := sql.NullString{String: "test", Valid: true}
	result := ScanNullString(validStr)
	if result != "test" {
		t.Errorf("Expected 'test', got '%s'", result)
	}

	// Test with NULL
	nullStr := sql.NullString{String: "", Valid: false}
	result = ScanNullString(nullStr)
	if result != "" {
		t.Errorf("Expected empty string, got '%s'", result)
	}
}

// Integration tests (require PostgreSQL on port 5555)
// Run with: go test -tags=integration ./...

// TODO: Add integration tests for InitDatabase
// TODO: Add integration tests for InitIdentityDatabase

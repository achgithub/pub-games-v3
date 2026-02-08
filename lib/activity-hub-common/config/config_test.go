package config

import (
	"os"
	"testing"
)

func TestGetEnv(t *testing.T) {
	// Test with default value
	result := GetEnv("NON_EXISTENT_VAR", "default")
	if result != "default" {
		t.Errorf("Expected 'default', got '%s'", result)
	}

	// Test with set value
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	result = GetEnv("TEST_VAR", "default")
	if result != "test_value" {
		t.Errorf("Expected 'test_value', got '%s'", result)
	}
}

func TestRequireEnv(t *testing.T) {
	// Test with set value
	os.Setenv("REQUIRED_VAR", "required_value")
	defer os.Unsetenv("REQUIRED_VAR")

	result := RequireEnv("REQUIRED_VAR")
	if result != "required_value" {
		t.Errorf("Expected 'required_value', got '%s'", result)
	}

	// Test panic on missing value
	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic for missing required env var")
		}
	}()

	RequireEnv("NON_EXISTENT_REQUIRED_VAR")
}

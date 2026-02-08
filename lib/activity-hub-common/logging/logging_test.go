package logging

import (
	"testing"
)

func TestNew(t *testing.T) {
	logger := New("test-app")

	if logger == nil {
		t.Error("Expected logger to be created")
	}

	if logger.appName != "test-app" {
		t.Errorf("Expected appName 'test-app', got '%s'", logger.appName)
	}

	// Test logging methods don't panic
	logger.Info("test info")
	logger.Error("test error")
	logger.Warn("test warning")
	logger.Debug("test debug")
	logger.Success("test success")
}

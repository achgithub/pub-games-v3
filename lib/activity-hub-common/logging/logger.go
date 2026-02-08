package logging

import (
	"log"
	"os"
)

// Logger represents a structured logger.
type Logger struct {
	appName string
	logger  *log.Logger
}

// New creates a new logger for the given app.
//
// Usage:
//   logger := logging.New("tic-tac-toe")
//   logger.Info("Server started")
//   logger.Error("Failed to connect", err)
func New(appName string) *Logger {
	return &Logger{
		appName: appName,
		logger:  log.New(os.Stdout, "["+appName+"] ", log.LstdFlags),
	}
}

// Info logs an informational message.
func (l *Logger) Info(message string, args ...interface{}) {
	l.logger.Printf("ℹ️  INFO: "+message, args...)
}

// Error logs an error message.
func (l *Logger) Error(message string, args ...interface{}) {
	l.logger.Printf("❌ ERROR: "+message, args...)
}

// Warn logs a warning message.
func (l *Logger) Warn(message string, args ...interface{}) {
	l.logger.Printf("⚠️  WARN: "+message, args...)
}

// Debug logs a debug message.
func (l *Logger) Debug(message string, args ...interface{}) {
	l.logger.Printf("🔍 DEBUG: "+message, args...)
}

// Success logs a success message.
func (l *Logger) Success(message string, args ...interface{}) {
	l.logger.Printf("✅ SUCCESS: "+message, args...)
}

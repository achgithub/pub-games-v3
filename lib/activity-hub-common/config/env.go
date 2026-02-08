package config

import "os"

// GetEnv retrieves an environment variable with a fallback default value.
//
// Usage:
//   port := config.GetEnv("PORT", "4001")
//   dbHost := config.GetEnv("DB_HOST", "127.0.0.1")
func GetEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// RequireEnv retrieves an environment variable and panics if not set.
// Use this for required configuration values.
//
// Usage:
//   jwtSecret := config.RequireEnv("JWT_SECRET")
func RequireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic("Required environment variable not set: " + key)
	}
	return value
}

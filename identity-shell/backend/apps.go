package main

import (
	"encoding/json"
	"log"
	"os"
	"sync"
)

// AppDefinition represents a registered app
type AppDefinition struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
	Category    string `json:"category,omitempty"`
	URL         string `json:"url,omitempty"`
	BackendPort int    `json:"backendPort,omitempty"`
	Realtime    string `json:"realtime,omitempty"`
	MinPlayers  int    `json:"minPlayers,omitempty"`
	MaxPlayers  int    `json:"maxPlayers,omitempty"`
}

// AppRegistry holds the loaded apps configuration
type AppRegistry struct {
	Apps []AppDefinition `json:"apps"`
	mu   sync.RWMutex
}

var appRegistry = &AppRegistry{}

// LoadAppRegistry loads apps from apps.json
func LoadAppRegistry() error {
	appRegistry.mu.Lock()
	defer appRegistry.mu.Unlock()

	data, err := os.ReadFile("./apps.json")
	if err != nil {
		return err
	}

	if err := json.Unmarshal(data, appRegistry); err != nil {
		return err
	}

	log.Printf("✅ Loaded %d apps from registry", len(appRegistry.Apps))
	return nil
}

// GetAppByID returns an app definition by ID, or nil if not found
func GetAppByID(appID string) *AppDefinition {
	appRegistry.mu.RLock()
	defer appRegistry.mu.RUnlock()

	for _, app := range appRegistry.Apps {
		if app.ID == appID {
			return &app
		}
	}
	return nil
}

// GetAllApps returns all registered apps
func GetAllApps() []AppDefinition {
	appRegistry.mu.RLock()
	defer appRegistry.mu.RUnlock()

	return appRegistry.Apps
}

// IsGameApp checks if an app is a game that can be challenged
func IsGameApp(appID string) bool {
	app := GetAppByID(appID)
	if app == nil {
		return false
	}
	return app.Category == "game" && app.BackendPort > 0
}

package main

import (
	"log"
	"sync"

	"github.com/lib/pq"
)

// AppDefinition represents a registered app
type AppDefinition struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Icon            string   `json:"icon"`
	Type            string   `json:"type"`
	Description     string   `json:"description,omitempty"`
	Category        string   `json:"category,omitempty"`
	URL             string   `json:"url,omitempty"`
	BackendPort     int      `json:"backendPort,omitempty"`
	Realtime        string   `json:"realtime,omitempty"`
	MinPlayers      int      `json:"minPlayers,omitempty"`
	MaxPlayers      int      `json:"maxPlayers,omitempty"`
	RequiredRoles   []string `json:"requiredRoles,omitempty"`
	Enabled         bool     `json:"enabled"`
	DisplayOrder    int      `json:"displayOrder"`
	GuestAccessible bool     `json:"guestAccessible,omitempty"`
}

// AppRegistry holds the loaded apps configuration
type AppRegistry struct {
	Apps []AppDefinition `json:"apps"`
	mu   sync.RWMutex
}

var appRegistry = &AppRegistry{}

// LoadAppRegistry loads apps from database
func LoadAppRegistry() error {
	appRegistry.mu.Lock()
	defer appRegistry.mu.Unlock()

	// Query all enabled apps ordered by display_order
	rows, err := db.Query(`
		SELECT id, name, icon, type, description, category,
		       COALESCE(url, ''), COALESCE(backend_port, 0), COALESCE(realtime, 'none'),
		       COALESCE(min_players, 0), COALESCE(max_players, 0),
		       COALESCE(required_roles, '{}'), enabled, display_order,
		       COALESCE(guest_accessible, FALSE)
		FROM applications
		WHERE enabled = TRUE
		ORDER BY display_order, name
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var apps []AppDefinition
	for rows.Next() {
		var app AppDefinition
		var requiredRoles pq.StringArray

		err := rows.Scan(
			&app.ID, &app.Name, &app.Icon, &app.Type, &app.Description, &app.Category,
			&app.URL, &app.BackendPort, &app.Realtime,
			&app.MinPlayers, &app.MaxPlayers,
			&requiredRoles, &app.Enabled, &app.DisplayOrder,
			&app.GuestAccessible,
		)
		if err != nil {
			return err
		}

		app.RequiredRoles = requiredRoles
		apps = append(apps, app)
	}

	if err = rows.Err(); err != nil {
		return err
	}

	appRegistry.Apps = apps
	log.Printf("✅ Loaded %d apps from database", len(appRegistry.Apps))
	return nil
}

// ReloadAppRegistry reloads apps from database (useful after admin updates)
func ReloadAppRegistry() error {
	return LoadAppRegistry()
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

// GetAppsForUser returns apps visible to a user based on their roles or guest status
// If isGuest is true, only returns apps with guest_accessible = true
// Otherwise, returns apps based on role requirements
func GetAppsForUser(userRoles []string, isGuest bool) []AppDefinition {
	appRegistry.mu.RLock()
	defer appRegistry.mu.RUnlock()

	var visibleApps []AppDefinition

	for _, app := range appRegistry.Apps {
		// Guest mode: only show guest-accessible apps
		if isGuest {
			if app.GuestAccessible {
				visibleApps = append(visibleApps, app)
			}
			continue
		}

		// Regular users: check role requirements
		// App has no role requirements - visible to everyone
		if len(app.RequiredRoles) == 0 {
			visibleApps = append(visibleApps, app)
			continue
		}

		// Check if user has any of the required roles
		if hasAnyRole(userRoles, app.RequiredRoles) {
			visibleApps = append(visibleApps, app)
		}
	}

	return visibleApps
}

// hasAnyRole checks if user has any of the required roles
func hasAnyRole(userRoles, requiredRoles []string) bool {
	for _, required := range requiredRoles {
		for _, userRole := range userRoles {
			if userRole == required {
				return true
			}
		}
	}
	return false
}

// IsGameApp checks if an app is a game that can be challenged
func IsGameApp(appID string) bool {
	app := GetAppByID(appID)
	if app == nil {
		return false
	}
	return app.Category == "game" && app.BackendPort > 0
}

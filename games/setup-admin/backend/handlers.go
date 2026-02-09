package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

// handleGetUsers returns all users with their roles
func handleGetUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := identityDB.Query(`
		SELECT email, name, is_admin, COALESCE(roles, '{}'), created_at
		FROM users
		ORDER BY is_admin DESC, name
	`)
	if err != nil {
		log.Printf("Error querying users: %v", err)
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var email, name string
		var isAdmin bool
		var roles pq.StringArray
		var createdAt interface{}

		err := rows.Scan(&email, &name, &isAdmin, &roles, &createdAt)
		if err != nil {
			log.Printf("Error scanning user: %v", err)
			continue
		}

		users = append(users, map[string]interface{}{
			"email":     email,
			"name":      name,
			"is_admin":  isAdmin,
			"roles":     roles,
			"createdAt": createdAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
	})
}

// handleUpdateUserRoles updates a user's roles
func handleUpdateUserRoles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	email := vars["email"]

	var req struct {
		Roles []string `json:"roles"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update roles in database
	_, err := identityDB.Exec(`
		UPDATE users
		SET roles = $1, is_admin = $2
		WHERE email = $3
	`, pq.Array(req.Roles), len(req.Roles) > 0, email)

	if err != nil {
		log.Printf("Error updating user roles: %v", err)
		http.Error(w, "Failed to update roles", http.StatusInternalServerError)
		return
	}

	// Log audit action
	adminEmail := r.Header.Get("X-Admin-Email")
	logAudit(adminEmail, "user_role_change", email, map[string]interface{}{
		"new_roles": req.Roles,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User roles updated successfully",
	})
}

// handleGetApps returns all apps from identity database
func handleGetApps(w http.ResponseWriter, r *http.Request) {
	rows, err := identityDB.Query(`
		SELECT id, name, icon, type, description, category,
		       COALESCE(url, ''), COALESCE(backend_port, 0), COALESCE(realtime, 'none'),
		       COALESCE(required_roles, '{}'), enabled, display_order
		FROM applications
		ORDER BY display_order, name
	`)
	if err != nil {
		log.Printf("Error querying apps: %v", err)
		http.Error(w, "Failed to fetch apps", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var apps []map[string]interface{}
	for rows.Next() {
		var id, name, icon, appType, description, category string
		var url, realtime string
		var backendPort, displayOrder int
		var requiredRoles pq.StringArray
		var enabled bool

		err := rows.Scan(
			&id, &name, &icon, &appType, &description, &category,
			&url, &backendPort, &realtime,
			&requiredRoles, &enabled, &displayOrder,
		)
		if err != nil {
			log.Printf("Error scanning app: %v", err)
			continue
		}

		apps = append(apps, map[string]interface{}{
			"id":            id,
			"name":          name,
			"icon":          icon,
			"type":          appType,
			"description":   description,
			"category":      category,
			"url":           url,
			"backendPort":   backendPort,
			"realtime":      realtime,
			"requiredRoles": requiredRoles,
			"enabled":       enabled,
			"displayOrder":  displayOrder,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"apps": apps,
	})
}

// handleUpdateApp updates an app's details
func handleUpdateApp(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["id"]

	var req struct {
		Name          string   `json:"name"`
		Icon          string   `json:"icon"`
		Description   string   `json:"description"`
		Category      string   `json:"category"`
		RequiredRoles []string `json:"requiredRoles"`
		DisplayOrder  int      `json:"displayOrder"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update app in database
	_, err := identityDB.Exec(`
		UPDATE applications
		SET name = $1, icon = $2, description = $3, category = $4,
		    required_roles = $5, display_order = $6
		WHERE id = $7
	`, req.Name, req.Icon, req.Description, req.Category,
		pq.Array(req.RequiredRoles), req.DisplayOrder, appID)

	if err != nil {
		log.Printf("Error updating app: %v", err)
		http.Error(w, "Failed to update app", http.StatusInternalServerError)
		return
	}

	// Log audit action
	adminEmail := r.Header.Get("X-Admin-Email")
	logAudit(adminEmail, "app_update", appID, map[string]interface{}{
		"name": req.Name,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "App updated successfully",
	})
}

// handleToggleApp enables or disables an app
func handleToggleApp(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["id"]
	action := vars["action"]

	enabled := action == "enable"

	_, err := identityDB.Exec("UPDATE applications SET enabled = $1 WHERE id = $2", enabled, appID)
	if err != nil {
		log.Printf("Error toggling app: %v", err)
		http.Error(w, "Failed to toggle app", http.StatusInternalServerError)
		return
	}

	// Log audit action
	adminEmail := r.Header.Get("X-Admin-Email")
	logAudit(adminEmail, "app_toggle", appID, map[string]interface{}{
		"enabled": enabled,
	})

	status := "disabled"
	if enabled {
		status = "enabled"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "App " + status + " successfully",
	})
}

// logAudit logs an admin action to the audit log
func logAudit(adminEmail, actionType, targetID string, details map[string]interface{}) {
	detailsJSON, _ := json.Marshal(details)

	_, err := appDB.Exec(`
		INSERT INTO audit_log (admin_email, action_type, target_id, details)
		VALUES ($1, $2, $3, $4)
	`, adminEmail, actionType, targetID, detailsJSON)

	if err != nil {
		log.Printf("Warning: Failed to log audit action: %v", err)
	}
}

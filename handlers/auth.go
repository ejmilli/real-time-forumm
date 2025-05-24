package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// CheckAuthHandler verifies if the user's session is valid
func CheckAuthHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("Auth check request received")

		session := GetSession(db, r)
		w.Header().Set("Content-Type", "application/json")

		if session == nil || session.ExpiresAt.Before(time.Now()) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"authenticated": false,
			})
			return
		}

		// Session is valid
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": true,
			"user_id":       session.UserID,
			"nickname":      session.Nickname,
		})
	}
}

// OnlineUsersHandler returns list of online users active in the last 5 minutes
func OnlineUsersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		fiveMinutesAgo := time.Now().Add(-5 * time.Minute)

		rows, err := db.Query(`
			SELECT DISTINCT s.nickname 
			FROM sessions s
			WHERE s.last_active > ?
			ORDER BY s.last_active DESC
		`, fiveMinutesAgo)
		if err != nil {
			log.Printf("Database error: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Database error",
			})
			return
		}
		defer rows.Close()

		var users []string
		for rows.Next() {
			var nickname string
			if err := rows.Scan(&nickname); err != nil {
				log.Printf("Error scanning nickname: %v", err)
				continue
			}
			users = append(users, nickname)
		}

		json.NewEncoder(w).Encode(users)
	}
}

// UpdateLastActive updates the session's last_active timestamp if valid
func UpdateLastActive(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	session := GetSession(db, r)
	if session != nil && session.ExpiresAt.After(time.Now()) {
		if cookie, err := r.Cookie("session"); err == nil {
			_, err = db.Exec(
				"UPDATE sessions SET last_active = ? WHERE id = ?",
				time.Now(), cookie.Value,
			)
			if err != nil {
				log.Printf("Last active update error: %v", err)
			}
		}
	}
}

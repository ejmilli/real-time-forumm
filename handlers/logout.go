package handlers

import (
	"database/sql"
	"log"
	"net/http"
)

// LogoutHandler handles user logout by invalidating the session
func LogoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("Logout request received")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Use existing ClearSession function to handle the logout
		ClearSession(db, w, r)

		log.Println("User logged out successfully")
		w.WriteHeader(http.StatusOK)
	}
}

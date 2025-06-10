package handlers

import (
	"database/sql"
	"log"
	"net/http"
)

// LoggingMiddleware logs HTTP requests
func LoggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next(w, r)
	}
}

// ActivityMiddleware - middleware to update user activity
func ActivityMiddleware(db *sql.DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		UpdateLastActive(db, w, r)
		next(w, r)
	}
}

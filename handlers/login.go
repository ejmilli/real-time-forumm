package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func LoginHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("Login request received")

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse form data
		if err := r.ParseForm(); err != nil {
			log.Printf("Error parsing form: %v", err)
			http.Error(w, "Invalid form data", http.StatusBadRequest)
			return
		}

		// Log received data for debugging
		log.Printf("Received login form data: %v", r.Form)

		loginType := r.FormValue("loginType")
		email := strings.TrimSpace(r.FormValue("email"))
		nickname := strings.TrimSpace(r.FormValue("nickname"))
		password := r.FormValue("password")

		// Validate form data
		if loginType != "email" && loginType != "nickname" {
			log.Printf("Invalid login type: %s", loginType)
			http.Error(w, "Invalid login type", http.StatusBadRequest)
			return
		}

		if password == "" {
			http.Error(w, "Password required", http.StatusBadRequest)
			return
		}

		var userID, storedNickname, passwordHash string
		var err error

		if loginType == "email" {
			if email == "" {
				http.Error(w, "Email required", http.StatusBadRequest)
				return
			}
			err = db.QueryRow(`SELECT id, nickname, password_hash FROM users WHERE email = ?`, email).
				Scan(&userID, &storedNickname, &passwordHash)
		} else { // nickname
			if nickname == "" {
				http.Error(w, "Nickname required", http.StatusBadRequest)
				return
			}
			err = db.QueryRow(`SELECT id, nickname, password_hash FROM users WHERE nickname = ?`, nickname).
				Scan(&userID, &storedNickname, &passwordHash)
		}

		if err == sql.ErrNoRows {
			log.Println("User not found")
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		} else if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Server error", http.StatusInternalServerError)
			return
		}

		// Compare password
		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
			log.Println("Password mismatch")
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		// Create session
		sessionID, err := CreateSession(db, w, userID, storedNickname)
		if err != nil {
			log.Printf("Session creation error: %v", err)
			http.Error(w, "Failed to create session", http.StatusInternalServerError)
			return
		}

		log.Printf("Login successful for user: %s, session: %s", storedNickname, sessionID)
		fmt.Fprintln(w, "Login successful")
	}
}

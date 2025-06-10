package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"real-time-forum/models"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
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

		// Update last_active when checking auth
		UpdateLastActive(db, w, r)

		// Session is valid
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": true,
			"user_id":       session.UserID,
			"nickname":      session.Nickname,
		})
	}
}

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

func SignupHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		contentType := r.Header.Get("Content-Type")
		if strings.Contains(contentType, "multipart/form-data") {
			if err := r.ParseMultipartForm(10 << 20); err != nil {
				http.Error(w, "Error parsing multipart form: "+err.Error(), http.StatusBadRequest)
				return
			}
		} else {
			if err := r.ParseForm(); err != nil {
				http.Error(w, "Error parsing form: "+err.Error(), http.StatusBadRequest)
				return
			}
		}

		firstName := getFormValue(r, []string{"firstname", "firstName", "first_name", "FirstName"})
		lastName := getFormValue(r, []string{"lastname", "lastName", "last_name", "LastName"})
		nickname := getFormValue(r, []string{"nickname", "nickName", "nick_name", "NickName"})
		ageStr := getFormValue(r, []string{"age", "Age"})
		gender := getFormValue(r, []string{"gender", "Gender"})
		email := getFormValue(r, []string{"email", "Email"})
		password := getFormValue(r, []string{"password", "Password", "passwd", "Passwd"})
		confirmPassword := getFormValue(r, []string{"confirmPassword", "confirm_password", "ConfirmPassword"})

		user, err := processAndValidateUser(firstName, lastName, nickname, ageStr, gender, email, password, confirmPassword, db)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := createUser(db, user); err != nil {
			status := http.StatusInternalServerError
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				status = http.StatusConflict
			}
			http.Error(w, err.Error(), status)
			return
		}

		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, "User created successfully")
	}
}

func getFormValue(r *http.Request, keys []string) string {
	for _, key := range keys {
		if value := r.FormValue(key); value != "" {
			return value
		}
	}
	return ""
}

// OnlineUsersHandler returns list of online users active in the last 5 minutes
func OnlineUsersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Get current user's session
		session := GetSession(db, r)
		if session == nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Unauthorized",
			})
			return
		}

		// Update current user's last_active
		UpdateLastActive(db, w, r)

		fiveMinutesAgo := time.Now().Add(-5 * time.Minute)

		// Get online users EXCLUDING current user
		rows, err := db.Query(`
			SELECT DISTINCT s.user_id, s.nickname 
			FROM sessions s
			WHERE s.expires_at > ? AND s.last_active > ? AND s.user_id != ?
			ORDER BY s.last_active DESC
		`, time.Now(), fiveMinutesAgo, session.UserID)

		if err != nil {
			log.Printf("Database error: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Database error",
			})
			return
		}
		defer rows.Close()

		var users []models.OnlineUser
		for rows.Next() {
			var user models.OnlineUser
			if err := rows.Scan(&user.ID, &user.Nickname); err != nil {
				log.Printf("Error scanning user data: %v", err)
				continue
			}
			users = append(users, user)
		}

		log.Printf("Found %d online users (excluding current user)", len(users))
		json.NewEncoder(w).Encode(users)
	}
}

// CurrentUserHandler returns the current logged-in user information
func CurrentUserHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		session := GetSession(db, r)
		if session == nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Unauthorized",
			})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"user": map[string]string{
				"id":       session.UserID,
				"nickname": session.Nickname,
			},
		})
	}
}

package handlers

import (
	"database/sql"
	"net/http"
	"real-time-forum/models"
	"time"

	"github.com/gofrs/uuid"
)

// CreateSession inserts a new session and sets a cookie
func CreateSession(db *sql.DB, w http.ResponseWriter, userID, nickname string) (string, error) {
	sessionID, err := uuid.NewV4()
	if err != nil {
		return "", err
	}
	sid := sessionID.String()
	expiresAt := time.Now().Add(15 * time.Minute)
	lastActive := time.Now()

	_, err = db.Exec(`
		INSERT INTO sessions (id, user_id, nickname, expires_at, last_active)
		VALUES (?, ?, ?, ?, ?)`,
		sid, userID, nickname, expiresAt, lastActive,
	)
	if err != nil {
		return "", err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    sid,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   86400, // 1 day
	})

	return sid, nil
}

// GetSession retrieves the session info if valid
func GetSession(db *sql.DB, r *http.Request) *models.Session {
	cookie, err := r.Cookie("session")
	if err != nil {
		return nil
	}

	var sess models.Session
	err = db.QueryRow(`
		SELECT user_id, nickname, expires_at FROM sessions WHERE id = ?`,
		cookie.Value,
	).Scan(&sess.UserID, &sess.Nickname, &sess.ExpiresAt)

	if err != nil || sess.ExpiresAt.Before(time.Now()) {
		return nil
	}

	// Optionally refresh session expiry on activity
	_, _ = db.Exec(`
		UPDATE sessions SET last_active = ?, expires_at = ? WHERE id = ?`,
		time.Now(), time.Now().Add(15*time.Minute), cookie.Value,
	)

	return &sess
}

// ClearSession deletes session from DB and clears cookie
func ClearSession(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session")
	if err == nil {
		db.Exec(`DELETE FROM sessions WHERE id = ?`, cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

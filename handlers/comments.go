package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"real-time-forum/models"
	"time"

	"github.com/gofrs/uuid"
)

// CreateComment handles adding a new comment to a post
func CreateComment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Check authentication - FIXED: Pass db parameter
		session := GetSession(db, r)
		if session == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Verify session is valid
		if session.ExpiresAt.Before(time.Now()) {
			http.Error(w, "Invalid session", http.StatusUnauthorized)
			return
		}

		var requestData struct {
			PostID  string `json:"post_id"`
			Content string `json:"body"` // Accept 'body' from frontend but use 'content' internally
		}

		err := json.NewDecoder(r.Body).Decode(&requestData)
		if err != nil {
			http.Error(w, "Invalid comment data", http.StatusBadRequest)
			return
		}

		// Validate required fields
		if requestData.PostID == "" || requestData.Content == "" {
			http.Error(w, "Post ID and comment content are required", http.StatusBadRequest)
			return
		}

		// Verify the post exists
		var postExists bool
		err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM posts WHERE id = ?)", requestData.PostID).Scan(&postExists)
		if err != nil || !postExists {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}

		// Generate UUID and create comment
		commentID, err := uuid.NewV4()
		if err != nil {
			http.Error(w, "Failed to generate comment ID", http.StatusInternalServerError)
			return
		}

		comment := models.Comment{
			ID:        commentID.String(),
			PostID:    requestData.PostID,
			UserID:    session.UserID,
			Nickname:  session.Nickname,
			Content:   requestData.Content,
			CreatedAt: time.Now(),
		}

		// Insert into database
		_, err = db.Exec(`
			INSERT INTO comments (id, post_id, user_id, nickname, content, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, comment.ID, comment.PostID, comment.UserID, comment.Nickname, comment.Content, comment.CreatedAt)

		if err != nil {
			http.Error(w, "Failed to save comment", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(comment)
	}
}

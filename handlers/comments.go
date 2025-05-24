package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"real-time-forum/models"
	"time"

	"github.com/gofrs/uuid"
)

// GetPostWithComments retrieves a single post with all its comments
func GetPostWithComments(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Check authentication first - FIXED: Pass db parameter
		session := GetSession(db, r)
		if session == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Verify session is valid - FIXED: Use session.UserID instead of separate query
		if session.ExpiresAt.Before(time.Now()) {
			http.Error(w, "Invalid session", http.StatusUnauthorized)
			return
		}

		postID := r.URL.Query().Get("id")
		if postID == "" {
			http.Error(w, "Post ID is required", http.StatusBadRequest)
			return
		}

		// First, get the post
		var post models.Post
		err := db.QueryRow(`
			SELECT id, user_id, category_id, title, content, likes, dislikes, created_at 
			FROM posts 
			WHERE id = ?
		`, postID).Scan(
			&post.ID, &post.UserID, &post.CategoryID, &post.Title, &post.Content, 
			&post.LikeCount, &post.DislikeCount, &post.CreatedAt,
		)
		
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Post not found", http.StatusNotFound)
				return
			}
			http.Error(w, "Failed to fetch post", http.StatusInternalServerError)
			return
		}

		// Then, get all comments for this post with user nicknames
		rows, err := db.Query(`
			SELECT c.id, c.post_id, c.user_id, c.nickname, c.content, c.created_at 
			FROM comments c
			WHERE c.post_id = ? 
			ORDER BY c.created_at ASC
		`, postID)
		
		if err != nil {
			http.Error(w, "Failed to fetch comments", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		// Prepare response structure
		var comments []models.Comment
		for rows.Next() {
			var c models.Comment
			err := rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.Nickname, &c.Content, &c.CreatedAt)
			if err != nil {
				http.Error(w, "Error scanning comment", http.StatusInternalServerError)
				return
			}
			comments = append(comments, c)
		}

		// Combine post and comments in one response
		response := struct {
			Post     models.Post      `json:"post"`
			Comments []models.Comment `json:"comments"`
		}{
			Post:     post,
			Comments: comments,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

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
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"real-time-forum/models"
	"time"

	"github.com/gofrs/uuid"
)

// PostsHandler handles both GET and POST for posts
func PostsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Check session first
		session := GetSession(db, r)
		if session == nil || session.ExpiresAt.Before(time.Now()) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		switch r.Method {
		case "GET":
			handleGetPosts(db, w, r, session)
		case "POST":
			handleCreatePost(db, w, r, session)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	}
}

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

// handleGetPosts gets posts with optional category filter
func handleGetPosts(db *sql.DB, w http.ResponseWriter, r *http.Request, session *models.Session) {
	category := r.URL.Query().Get("category")

	var rows *sql.Rows
	var err error

	if category != "" && category != "all" {
		// FIXED: Added missing backtick and fixed query syntax
		rows, err = db.Query(`
            SELECT id, user_id, category_id, title, content, likes, dislikes, created_at 
            FROM posts 
            WHERE category_id = ? 
            ORDER BY created_at DESC`,
			category)
	} else {
		// FIXED: Added missing backtick
		rows, err = db.Query(`
            SELECT id, user_id, category_id, title, content, likes, dislikes, created_at 
            FROM posts 
            ORDER BY created_at DESC`)
	}

	if err != nil {
		http.Error(w, "Failed to fetch posts", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var p models.Post
		err := rows.Scan(&p.ID, &p.UserID, &p.CategoryID, &p.Title, &p.Content, &p.LikeCount, &p.DislikeCount, &p.CreatedAt)
		if err != nil {
			http.Error(w, "Error scanning post", http.StatusInternalServerError)
			return
		}
		posts = append(posts, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

// handleCreatePost creates a new post
func handleCreatePost(db *sql.DB, w http.ResponseWriter, r *http.Request, session *models.Session) {
	var post models.Post
	err := json.NewDecoder(r.Body).Decode(&post)
	if err != nil {
		http.Error(w, "Invalid post data", http.StatusBadRequest)
		return
	}

	// Validation
	if post.Title == "" || post.Content == "" {
		http.Error(w, "Title and content are required", http.StatusBadRequest)
		return
	}

	postID, err := uuid.NewV4()
	if err != nil {
		http.Error(w, "Failed to generate post ID", http.StatusInternalServerError)
		return
	}
	post.ID = postID.String()
	post.CreatedAt = time.Now()

	// Use user ID from session
	post.UserID = session.UserID

	if post.CategoryID == "" {
		post.CategoryID = "general"
	}

	// FIXED: SQL syntax errors - removed extra comma and fixed query structure
	_, err = db.Exec(`
        INSERT INTO posts (id, user_id, category_id, title, content, likes, dislikes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		post.ID, post.UserID, post.CategoryID, post.Title, post.Content, 0, 0, post.CreatedAt,
	)
	if err != nil {
		http.Error(w, "Failed to save post", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(post)
}

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

// handleGetPosts gets posts with optional category filter
func handleGetPosts(db *sql.DB, w http.ResponseWriter, r *http.Request, session *Session) {
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
func handleCreatePost(db *sql.DB, w http.ResponseWriter, r *http.Request, session *Session) {
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
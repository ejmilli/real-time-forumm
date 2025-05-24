package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"real-time-forum/db"
	"real-time-forum/handlers"

	_ "github.com/mattn/go-sqlite3"
)

// LoggingMiddleware logs HTTP requests
func LoggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next(w, r)
	}
}
func ActivityMiddleware(db *sql.DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handlers.UpdateLastActive(db, w, r)
		next(w, r)
	}
}

func main() {
	// Set up logging
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting server...")

	// Connect to database
	dbConn, err := sql.Open("sqlite3", "./yourdb.sqlite")
	if err != nil {
		log.Fatal(err)
	}
	defer dbConn.Close()

	db.InitializeSchema(dbConn)
	log.Println("Database schema initialized")

	// Set up static file server
	fs := http.FileServer(http.Dir("./"))
	http.Handle("/", fs)

	// Set up API routes with logging
	http.HandleFunc("/signup", LoggingMiddleware(handlers.SignupHandler(dbConn)))
	http.HandleFunc("/login", LoggingMiddleware(handlers.LoginHandler(dbConn)))

	// post 
	http.HandleFunc("/api/posts", LoggingMiddleware(ActivityMiddleware(dbConn, handlers.PostsHandler(dbConn))))


	// Session management endpoints
	http.HandleFunc("/api/check-auth", LoggingMiddleware(handlers.CheckAuthHandler(dbConn)))
	http.HandleFunc("/api/logout", LoggingMiddleware(handlers.LogoutHandler(dbConn)))
	// Add new endpoint
	http.HandleFunc("/api/online-users", LoggingMiddleware(ActivityMiddleware(dbConn, handlers.OnlineUsersHandler(dbConn))))

	// Start server
	fmt.Println("Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

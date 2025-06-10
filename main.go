package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"real-time-forum/db"
	"real-time-forum/handlers"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}
var connManager = handlers.NewConnectionManager()

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
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	// Set up API routes with logging
	http.HandleFunc("/signup", handlers.LoggingMiddleware(handlers.SignupHandler(dbConn)))
	http.HandleFunc("/login", handlers.LoggingMiddleware(handlers.LoginHandler(dbConn)))

	// Posts routes
	http.HandleFunc("/api/posts", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.PostsHandler(dbConn))))

	// Post details route - NEW
	http.HandleFunc("/api/post-details", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.GetPostWithComments(dbConn))))

	// Comments route - NEW
	http.HandleFunc("/api/comments", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.CreateComment(dbConn))))

	// Session management endpoints
	http.HandleFunc("/api/check-auth", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.CheckAuthHandler(dbConn))))
	http.HandleFunc("/api/logout", handlers.LoggingMiddleware(handlers.LogoutHandler(dbConn)))

	// Online users endpoint with activity tracking
	http.HandleFunc("/api/online-users", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.OnlineUsersHandler(dbConn))))
	http.HandleFunc("/api/users", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.OnlineUsersHandler(dbConn))))

	// Current user endpoint with activity tracking
	http.HandleFunc("/api/user/current", handlers.LoggingMiddleware(handlers.CurrentUserHandler(dbConn)))

	// Chat endpoints with activity tracking
	http.HandleFunc("/api/chat", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.HandleChatRequest(dbConn))))
	http.HandleFunc("/api/chat/history", handlers.LoggingMiddleware(handlers.ActivityMiddleware(dbConn, handlers.HandleChatHistory(dbConn))))

	// WebSocket endpoint - pass both connection manager and upgrader
	http.HandleFunc("/ws", handlers.HandleWebSocket(dbConn, connManager, upgrader))

	// Start server
	fmt.Println("Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

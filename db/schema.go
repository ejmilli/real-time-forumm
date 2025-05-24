package db

import (
	"database/sql"
	"log"
)

// InitializeSchema runs the SQL to set up all the necessary tables
func InitializeSchema(db *sql.DB) {
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		first_name TEXT NOT NULL,
		last_name TEXT NOT NULL,
		nickname TEXT NOT NULL UNIQUE,
		age INTEGER NOT NULL,
		gender TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL
	);`

createSessionsTable := `
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	nickname TEXT NOT NULL,
	expires_at DATETIME NOT NULL,
	last_active DATETIME NOT NULL,
	FOREIGN KEY(user_id) REFERENCES users(id)
);`


	createPostsTable := `
	CREATE TABLE IF NOT EXISTS posts (
		id TEXT PRIMARY KEY, 
		user_id TEXT NOT NULL, 
		category_id TEXT DEFAULT 'general',
		title TEXT NOT NULL, 
		content TEXT NOT NULL, 
		likes INTEGER DEFAULT 0, 
		dislikes INTEGER DEFAULT 0, 
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);`


	createCommentsTable := `
CREATE TABLE IF NOT EXISTS comments (
	id TEXT PRIMARY KEY,
	post_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	nickname TEXT NOT NULL,
	content TEXT NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	parent_id TEXT DEFAULT NULL,
	FOREIGN KEY(post_id) REFERENCES posts(id),
	FOREIGN KEY(user_id) REFERENCES users(id),
	FOREIGN KEY(parent_id) REFERENCES comments(id)
);`

	_, err := db.Exec(createUsersTable)
	if err != nil {
		log.Fatalf("error creating users table: %v", err)
	}

	_, err = db.Exec(createSessionsTable)
	if err != nil {
		log.Fatalf("error creating sessions table: %v", err)
	}


	_, err = db.Exec(createPostsTable) 
	if err != nil {
		log.Fatalf("error creating posts table: %v", err)
	}

		_, err = db.Exec(createCommentsTable) 
	if err != nil {
		log.Fatalf("error creating comments table: %v", err)
	}

	
}
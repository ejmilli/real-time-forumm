package db

import (
	"database/sql"
	"log"
)

// InitializeSchema runs the SQL to set up the users and sessions tables
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

	// last_active is a new column for tracking online users
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

	createChatsTable := `
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user1_id) REFERENCES users(id),
    FOREIGN KEY(user2_id) REFERENCES users(id)
);`

	createMessagesTable := `CREATE TABLE IF NOT EXISTS messages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	chat_id INTEGER NOT NULL,
	sender_id TEXT NOT NULL,
	content TEXT NOT NULL,
	sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(chat_id) REFERENCES chats(id),
	FOREIGN KEY(sender_id) REFERENCES users(id)
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

	_, err = db.Exec(createChatsTable)
	if err != nil {
		log.Fatalf("error creating chats table: %v", err)
	}

	_, err = db.Exec(createMessagesTable)
	if err != nil {
		log.Fatalf("error creating messages table: %v", err)
	}

	alterSessionsTable := `
	ALTER TABLE sessions ADD COLUMN last_active DATETIME DEFAULT CURRENT_TIMESTAMP;`

	db.Exec(alterSessionsTable) // Ignore error - column might already exist

	// Update existing sessions that might not have last_active set
	updateExistingSessions := `
	UPDATE sessions 
	SET last_active = CURRENT_TIMESTAMP 
	WHERE last_active IS NULL;`

	_, err = db.Exec(updateExistingSessions)
	if err != nil {
		log.Printf("Warning: Could not update existing sessions: %v", err)
	}

	log.Println("✅ Database schema initialized successfully.")
}

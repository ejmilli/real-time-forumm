package models

import "time"

type User struct {
	ID           string
	FirstName    string
	LastName     string
	Nickname     string
	Age          int
	Gender       string
	Email        string
	PasswordHash string
}

type Post struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	CategoryID   string    `json:"category_id"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	LikeCount    int       `json:"like_count"`
	DislikeCount int       `json:"dislike_count"`
	CreatedAt    time.Time `json:"created_at"`
}

type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	UserID    string    `json:"user_id"`
	Nickname  string    `json:"nickname"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type Session struct {
	UserID    string
	Nickname  string
	ExpiresAt time.Time
}

type OnlineUser struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
}

type Message struct {
	ID         int    `json:"id"`
	ChatID     int    `json:"chat_id"`
	SenderID   string `json:"sender_id"`
	SenderName string `json:"sender_name"`
	Message    string `json:"message"`
	Time       string `json:"time"`
}

type WebSocketMessage struct {
	Type       string `json:"type"`
	ChatID     int    `json:"chatId"`
	ReceiverID string `json:"receiverId"`
	SenderName string `json:"senderName"`
	Message    string `json:"message"`
}

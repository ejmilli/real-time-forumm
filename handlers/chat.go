package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"real-time-forum/models"
	"strconv"
)

func HandleChatRequest(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := GetSession(db, r)
		if session == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		user2_id := r.URL.Query().Get("user")
		if user2_id == "" || user2_id == session.UserID {
			http.Error(w, "Invalid target user", http.StatusBadRequest)
			return
		}

		chatId, err := findOrCreateChat(db, session.UserID, user2_id)
		if err != nil {
			http.Error(w, "Chat creation failed", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"chatId":  chatId,
		})
	}
}

func HandleChatHistory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		session := GetSession(db, r)
		if session == nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Unauthorized",
			})
			return
		}

		user2 := r.URL.Query().Get("receiverId")
		if user2 == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "receiverId is required",
			})
			return
		}

		chatId, err := findOrCreateChat(db, session.UserID, user2)
		if err != nil {
			log.Printf("Error finding/creating chat: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to load chat history",
			})
			return
		}

		// Pagination parameters
		limit := 10 // default
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 50 {
				limit = n
			}
		}
		before := r.URL.Query().Get("before") // message id

		query := `
            SELECT m.id, m.chat_id, m.sender_id, u.nickname, m.content, m.sent_at
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
        `
		args := []interface{}{chatId}
		if before != "" {
			query += " AND m.id < ?"
			args = append(args, before)
		}
		query += " ORDER BY m.id DESC LIMIT ?"
		args = append(args, limit)

		rows, err := db.Query(query, args...)
		if err != nil {
			log.Printf("Database error loading chat history: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to load chat history",
			})
			return
		}
		defer rows.Close()

		var messages []models.Message
		for rows.Next() {
			var msg models.Message
			if err := rows.Scan(&msg.ID, &msg.ChatID, &msg.SenderID, &msg.SenderName, &msg.Message, &msg.Time); err != nil {
				log.Printf("Error scanning message: %v", err)
				continue
			}
			messages = append(messages, msg)
		}

		// Reverse to chronological order (oldest first)
		for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
			messages[i], messages[j] = messages[j], messages[i]
		}

		log.Printf("Loaded %d messages for chatId=%d", len(messages), chatId)

		response := map[string]interface{}{
			"success":  true,
			"messages": messages,
		}

		json.NewEncoder(w).Encode(response)
	}
}

func findOrCreateChat(db *sql.DB, user1, user2 string) (int, error) {
	var chatId int
	err := db.QueryRow(`
        SELECT id FROM chats 
        WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
		user1, user2, user2, user1,
	).Scan(&chatId)

	if err == sql.ErrNoRows {
		res, err := db.Exec(`INSERT INTO chats (user1_id, user2_id) VALUES (?, ?)`, user1, user2)
		if err != nil {
			return 0, err
		}
		id, _ := res.LastInsertId()
		return int(id), nil
	}
	return chatId, err
}

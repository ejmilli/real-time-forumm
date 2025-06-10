package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"real-time-forum/models"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket connection manager
type ConnectionManager struct {
	connections map[string]*websocket.Conn
	mutex       sync.RWMutex
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string]*websocket.Conn),
	}
}

func (cm *ConnectionManager) AddConnection(userID string, conn *websocket.Conn) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	cm.connections[userID] = conn
}

func (cm *ConnectionManager) RemoveConnection(userID string) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	delete(cm.connections, userID)
}

func (cm *ConnectionManager) GetConnection(userID string) (*websocket.Conn, bool) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	conn, exists := cm.connections[userID]
	return conn, exists
}

func (cm *ConnectionManager) Broadcast(message interface{}) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	for userID, conn := range cm.connections {
		if err := conn.WriteJSON(message); err != nil {
			log.Printf("Error broadcasting to user %s: %v", userID, err)
			// Remove the connection from map
			cm.mutex.RUnlock()
			cm.RemoveConnection(userID)
			cm.mutex.RLock()
		}
	}
}

func HandleWebSocket(dbConn *sql.DB, connManager *ConnectionManager, upgrader websocket.Upgrader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Session auth check
		session := GetSession(dbConn, r)
		if session == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("WebSocket upgrade error:", err)
			return
		}
		defer conn.Close()

		// Register the connection
		connManager.AddConnection(session.UserID, conn)
		defer connManager.RemoveConnection(session.UserID)

		log.Printf("WebSocket connected for user: %s (%s)", session.Nickname, session.UserID)

		for {
			var msg models.WebSocketMessage
			err := conn.ReadJSON(&msg)
			if err != nil {
				log.Println("WebSocket read error:", err)
				break
			}

			log.Printf("Received WebSocket message: %+v", msg)

			switch msg.Type {
			case "message":
				if msg.Message == "" {
					continue
				}

				messageID, err := saveMessage(dbConn, msg.ChatID, session.UserID, msg.Message)
				if err != nil {
					log.Printf("Error saving message: %v", err)
					continue
				}

				response := map[string]interface{}{
					"type":        "message",
					"id":          messageID,
					"chatId":      msg.ChatID,
					"sender_id":   session.UserID,
					"sender_name": session.Nickname,
					"message":     msg.Message,
					"time":        time.Now().Format("2006-01-02 15:04:05"),
				}

				// To sender
				if err := conn.WriteJSON(response); err != nil {
					log.Printf("Error sending to sender: %v", err)
				}

				// To receiver
				if receiverConn, ok := connManager.GetConnection(msg.ReceiverID); ok {
					if err := receiverConn.WriteJSON(response); err != nil {
						log.Printf("Error sending to receiver: %v", err)
					}
				}
				log.Print(msg.ReceiverID)

			case "typing":
				typingMsg := map[string]interface{}{
					"type":       "typing",
					"chatId":     msg.ChatID,
					"senderId":   session.UserID,
					"senderName": session.Nickname,
				}
				if receiverConn, ok := connManager.GetConnection(msg.ReceiverID); ok {
					if err := receiverConn.WriteJSON(typingMsg); err != nil {
						log.Printf("Error sending typing to receiver: %v", err)
					}
				}

			case "stop_typing":
				stopTypingMsg := map[string]interface{}{
					"type":     "stop_typing",
					"chatId":   msg.ChatID,
					"senderId": session.UserID,
				}
				if receiverConn, ok := connManager.GetConnection(msg.ReceiverID); ok {
					if err := receiverConn.WriteJSON(stopTypingMsg); err != nil {
						log.Printf("Error sending stop_typing to receiver: %v", err)
					}
				}
			}
		}
	}
}

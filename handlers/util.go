package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"real-time-forum/models"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gofrs/uuid"
	"golang.org/x/crypto/bcrypt"
)

func processAndValidateUser(firstName, lastName, nickname, ageStr, gender, email, password, confirmPassword string, db *sql.DB) (*models.User, error) {
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	nickname = strings.TrimSpace(nickname)
	ageStr = strings.TrimSpace(ageStr)
	gender = strings.TrimSpace(gender)
	email = strings.TrimSpace(email)

	if firstName == "" || lastName == "" || nickname == "" || gender == "" || email == "" {
		return nil, fmt.Errorf("all fields are required")
	}
	if len(nickname) < 3 || len(nickname) > 16 || !regexp.MustCompile(`^[\w\-]+$`).MatchString(nickname) {
		return nil, fmt.Errorf("invalid nickname format")
	}
	age, err := strconv.Atoi(ageStr)
	if err != nil || age < 13 || age > 100 {
		return nil, fmt.Errorf("age must be between 13-100")
	}
	if !regexp.MustCompile(`^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`).MatchString(email) {
		return nil, fmt.Errorf("invalid email format")
	}
	if len(password) < 8 || strings.ToLower(password) == "password" || password != confirmPassword {
		return nil, fmt.Errorf("passwords do not match or are too weak")
	}
	if exists, _ := checkExists(db, "email", email); exists {
		return nil, fmt.Errorf("email already registered")
	}
	if exists, _ := checkExists(db, "nickname", nickname); exists {
		return nil, fmt.Errorf("nickname already taken")
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to create user")
	}
	id, err := uuid.NewV4()
	if err != nil {
		return nil, fmt.Errorf("failed to create user")
	}
	return &models.User{
		ID:           id.String(),
		FirstName:    firstName,
		LastName:     lastName,
		Nickname:     nickname,
		Age:          age,
		Gender:       gender,
		Email:        email,
		PasswordHash: string(hashedPassword),
	}, nil
}

func checkExists(db *sql.DB, field, value string) (bool, error) {
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM users WHERE %s = ?", field)
	err := db.QueryRow(query, value).Scan(&count)
	return count > 0, err
}

func createUser(db *sql.DB, user *models.User) error {
	_, err := db.Exec(`
		INSERT INTO users 
		(id, first_name, last_name, nickname, age, gender, email, password_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID,
		user.FirstName,
		user.LastName,
		user.Nickname,
		user.Age,
		user.Gender,
		user.Email,
		user.PasswordHash,
	)
	return err
}

func saveMessage(db *sql.DB, chatID int, senderID, message string) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO messages (chat_id, sender_id, content, sent_at)
		VALUES (?, ?, ?, ?)
	`, chatID, senderID, message, time.Now())

	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// UpdateLastActive updates the session's last_active timestamp if valid
func UpdateLastActive(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	session := GetSession(db, r)
	if session != nil && session.ExpiresAt.After(time.Now()) {
		if cookie, err := r.Cookie("session"); err == nil {
			_, err = db.Exec(
				"UPDATE sessions SET last_active = ? WHERE id = ?",
				time.Now(), cookie.Value,
			)
			if err != nil {
				log.Printf("Last active update error: %v", err)
			} else {
				log.Printf("Updated last_active for session: %s", cookie.Value)
			}
		}
	}
}

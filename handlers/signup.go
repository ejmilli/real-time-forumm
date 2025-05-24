package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"real-time-forum/models"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofrs/uuid"
	"golang.org/x/crypto/bcrypt"
)


func SignupHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		contentType := r.Header.Get("Content-Type")
		if strings.Contains(contentType, "multipart/form-data") {
			if err := r.ParseMultipartForm(10 << 20); err != nil {
				http.Error(w, "Error parsing multipart form: "+err.Error(), http.StatusBadRequest)
				return
			}
		} else {
			if err := r.ParseForm(); err != nil {
				http.Error(w, "Error parsing form: "+err.Error(), http.StatusBadRequest)
				return
			}
		}

		firstName := getFormValue(r, []string{"firstname", "firstName", "first_name", "FirstName"})
		lastName := getFormValue(r, []string{"lastname", "lastName", "last_name", "LastName"})
		nickname := getFormValue(r, []string{"nickname", "nickName", "nick_name", "NickName"})
		ageStr := getFormValue(r, []string{"age", "Age"})
		gender := getFormValue(r, []string{"gender", "Gender"})
		email := getFormValue(r, []string{"email", "Email"})
		password := getFormValue(r, []string{"password", "Password", "passwd", "Passwd"})
		confirmPassword := getFormValue(r, []string{"confirmPassword", "confirm_password", "ConfirmPassword"})

		user, err := processAndValidateUser(firstName, lastName, nickname, ageStr, gender, email, password, confirmPassword, db)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := createUser(db, user); err != nil {
			status := http.StatusInternalServerError
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				status = http.StatusConflict
			}
			http.Error(w, err.Error(), status)
			return
		}

		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, "User created successfully")
	}
}

func getFormValue(r *http.Request, keys []string) string {
	for _, key := range keys {
		if value := r.FormValue(key); value != "" {
			return value
		}
	}
	return ""
}

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



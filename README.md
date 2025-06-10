# Real-Time Forum

A full-stack real-time forum web application with user authentication, posts, comments, and private chat (with online user list and real-time messaging).

---

## Features

- User registration and login (nickname/email + password)
- User profile: nickname, age, gender, first/last name, email
- Create, view, and comment on posts
- Real-time private chat with online users
- Online users list (sorted by activity and alphabetically)
- Real-time notifications and typing indicators
- Infinite scroll for chat history (loads 10 messages at a time)
- Session-based authentication

---

## Requirements

- Go 1.18+ (backend)
- SQLite3 (or your configured DB)
- Modern web browser

---

## Getting Started

### 1. **Clone the repository**

```sh
git clone https://github.com/chmyint/real-time-forum.git
cd real-time-forum
```

### 2. **Configure the database**

- By default, the app uses SQLite.  
- The database file will be created automatically (e.g., `forum.db`).
- If you want to use another DB, update the connection in `main.go`.

### 3. **Run the backend**

```sh
go run main.go
```
- The server will start on `http://localhost:8080` by default.

### 4. **Access the forum**

Open your browser and go to:  
[http://localhost:8080](http://localhost:8080)

---

## Project Structure

```
real-time-forum/
├── handlers/         # Go HTTP handlers (auth, posts, chat, etc.)
├── models/           # Go data models
├── static/           # Frontend static files (HTML, CSS, JS)
│   ├── index.html
│   ├── css/
│   └── js/
├── main.go           # Entry point for the Go server
├── forum.db          # SQLite database (created at runtime)
└── README.md
```

---

## Usage

- **Register** a new user with all required fields.
- **Login** with your nickname or email and password.
- **Create posts** and comment on posts.
- **See online users** in the sidebar.
- **Click a user** to start a private chat.
- **Chat** in real time, with typing indicators and message history.
- **Scroll up** in chat to load older messages (10 at a time, throttled).

---

## Development

- **Frontend:** Edit files in `static/`.
- **Backend:** Edit Go files in the root or `handlers/`, `models/`.

To restart the server after code changes:
```sh
go run main.go
```

---

## Notes

- WebSocket is used for real-time chat.
- All API endpoints are under `/api/`.
- Session cookies are used for authentication.
- No external Go packages are required (standard library only).

---

## Troubleshooting

- **Port in use:** Change the port in `main.go` if `8080` is busy.
- **Database issues:** Delete `yourdb.sqlite` to reset the database (will lose all data).
- **WebSocket not connecting:** Ensure you use `ws://` (not `wss://`) for local development.

---

## License

MIT License

---

**Enjoy your real-time forum!**
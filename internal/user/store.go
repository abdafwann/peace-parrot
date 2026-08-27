package user

import (
	"database/sql"
	"errors"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/google/uuid"
)

// ErrUserNotFound indicates user doesn't exist
var ErrUserNotFound = errors.New("user not found")

// Store handles user database operations
type Store struct {
	db *database.DB
}

// NewStore creates a new user store
func NewStore(db *database.DB) *Store {
	return &Store{db: db}
}

// User represents a user in the database (matches spec-data-model.md)
type User struct {
	ID           string
	Username     string
	PasswordHash string
	AvatarURL    string
	DisplayName  string
	Bio          string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// CreateUser creates a new user
func (s *Store) CreateUser(user *User) error {
	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	query := `
		INSERT INTO users (id, username, password_hash, avatar_url, display_name, bio, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		user.ID,
		user.Username,
		user.PasswordHash,
		user.AvatarURL,
		user.DisplayName,
		user.Bio,
		user.CreatedAt,
		user.UpdatedAt,
	)
	return err
}

// GetUserByUsername retrieves user by username
func (s *Store) GetUserByUsername(username string) (*User, error) {
	query := `
		SELECT id, username, password_hash, avatar_url, display_name, bio, created_at, updated_at
		FROM users WHERE username = ?
	`

	user := &User{}
	err := s.db.QueryRow(query, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.DisplayName,
		&user.Bio,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

// GetUserByID retrieves user by ID
func (s *Store) GetUserByID(id string) (*User, error) {
	query := `
		SELECT id, username, password_hash, avatar_url, display_name, bio, created_at, updated_at
		FROM users WHERE id = ?
	`

	user := &User{}
	err := s.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.DisplayName,
		&user.Bio,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

// UpdateUser updates user data
func (s *Store) UpdateUser(user *User) error {
	user.UpdatedAt = time.Now()

	query := `
		UPDATE users SET
			avatar_url = ?,
			display_name = ?,
			bio = ?,
			updated_at = ?
		WHERE id = ?
	`

	result, err := s.db.Exec(query,
		user.AvatarURL,
		user.DisplayName,
		user.Bio,
		user.UpdatedAt,
		user.ID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrUserNotFound
	}

	return nil
}

// ListUsers retrieves all users
func (s *Store) ListUsers() ([]*User, error) {
	query := `
		SELECT id, username, avatar_url, display_name, bio, created_at, updated_at
		FROM users
		ORDER BY username ASC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		u := &User{}
		var avatarURL, displayName, bio sql.NullString
		if err := rows.Scan(
			&u.ID,
			&u.Username,
			&avatarURL,
			&displayName,
			&bio,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if avatarURL.Valid {
			u.AvatarURL = avatarURL.String
		}
		if displayName.Valid {
			u.DisplayName = displayName.String
		}
		if bio.Valid {
			u.Bio = bio.String
		}
		users = append(users, u)
	}

	return users, rows.Err()
}

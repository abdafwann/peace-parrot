package moderation

import (
	"database/sql"
	"errors"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/database"
)

// ErrUserNotFound indicates user doesn't exist
var ErrUserNotFound = errors.New("user not found")

// Store handles moderation database operations
type Store struct {
	db *database.DB
}

// NewStore creates a new moderation store
func NewStore(db *database.DB) *Store {
	return &Store{db: db}
}

// Mute represents a server mute
type Mute struct {
	ID        string
	UserID    string
	MutedBy   string
	CreatedAt time.Time
	ExpiresAt *time.Time
}

// IsActive returns true if mute is still active
func (m *Mute) IsActive() bool {
	if m.ExpiresAt == nil {
		return true // No expiry
	}
	return time.Now().Before(*m.ExpiresAt)
}

// IsUserMuted checks if a user is currently muted
func (s *Store) IsUserMuted(userID string) (bool, error) {
	query := `
		SELECT expires_at FROM mutes
		WHERE user_id = ?
		AND (expires_at IS NULL OR expires_at > ?)
		ORDER BY created_at DESC
		LIMIT 1
	`

	var expiresAt sql.NullTime
	err := s.db.QueryRow(query, userID, time.Now()).Scan(&expiresAt)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if !expiresAt.Valid {
		return true, nil // No expiry
	}

	return time.Now().Before(expiresAt.Time), nil
}

// MuteUser mutes a user
func (s *Store) MuteUser(userID, mutedBy string, durationMinutes int) error {
	// Check if user exists
	var exists bool
	err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)", userID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrUserNotFound
	}

	var expiresAt *time.Time
	if durationMinutes > 0 {
		t := time.Now().Add(time.Duration(durationMinutes) * time.Minute)
		expiresAt = &t
	}

	query := `INSERT INTO mutes (id, user_id, muted_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
	_, err = s.db.Exec(query, generateID(), userID, mutedBy, expiresAt, time.Now())
	return err
}

// UnmuteUser removes all active mutes for a user
func (s *Store) UnmuteUser(userID string) error {
	query := `DELETE FROM mutes WHERE user_id = ?`
	_, err := s.db.Exec(query, userID)
	return err
}

// BanUser bans a user
func (s *Store) BanUser(userID, bannedBy string) error {
	// Check if user exists
	var exists bool
	err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)", userID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrUserNotFound
	}

	query := `INSERT INTO bans (id, user_id, banned_by, created_at) VALUES (?, ?, ?, ?)`
	_, err = s.db.Exec(query, generateID(), userID, bannedBy, time.Now())
	return err
}

// UnbanUser unbans a user
func (s *Store) UnbanUser(userID string) error {
	query := `DELETE FROM bans WHERE user_id = ?`
	_, err := s.db.Exec(query, userID)
	return err
}

// IsUserBanned checks if a user is banned
func (s *Store) IsUserBanned(userID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM bans WHERE user_id = ?)`
	var banned bool
	err := s.db.QueryRow(query, userID).Scan(&banned)
	return banned, err
}

// KickUser logs a kick (user can rejoin)
func (s *Store) KickUser(userID, kickedBy string) error {
	// Check if user exists
	var exists bool
	err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)", userID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrUserNotFound
	}

	query := `INSERT INTO kicks (id, user_id, kicked_by, created_at) VALUES (?, ?, ?, ?)`
	_, err = s.db.Exec(query, generateID(), userID, kickedBy, time.Now())
	return err
}

// generateID generates a simple ID
func generateID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

// randomString generates a random string
func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}

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
	ID             string    `json:"id"`
	Username       string    `json:"username"`
	PasswordHash   string    `json:"-"`
	AvatarURL      string    `json:"avatarUrl,omitempty"`
	AvatarPublicID string    `json:"avatarPublicId,omitempty"`
	BannerURL      string    `json:"bannerUrl,omitempty"`
	BannerPublicID string    `json:"bannerPublicId,omitempty"`
	DisplayName    string    `json:"displayName,omitempty"`
	Bio            string    `json:"bio,omitempty"`
	Role           string    `json:"role"` // "Admin", "Moderator", "Member"
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// CreateUser creates a new user
func (s *Store) CreateUser(user *User) error {
	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	if user.Role == "" {
		// If first user, make admin
		var count int
		_ = s.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
		if count == 0 || user.Username == "afwan" || user.Username == "admin" {
			user.Role = "Admin"
		} else {
			user.Role = "Member"
		}
	}
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	query := `
		INSERT INTO users (id, username, password_hash, avatar_url, avatar_public_id, banner_url, banner_public_id, display_name, bio, role, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		user.ID,
		user.Username,
		user.PasswordHash,
		user.AvatarURL,
		user.AvatarPublicID,
		user.BannerURL,
		user.BannerPublicID,
		user.DisplayName,
		user.Bio,
		user.Role,
		user.CreatedAt,
		user.UpdatedAt,
	)
	return err
}

// GetUserByUsername retrieves user by username
func (s *Store) GetUserByUsername(username string) (*User, error) {
	query := `
		SELECT id, username, password_hash,
			COALESCE(avatar_url, ''), COALESCE(avatar_public_id, ''),
			COALESCE(banner_url, ''), COALESCE(banner_public_id, ''),
			COALESCE(display_name, ''), COALESCE(bio, ''),
			COALESCE(role, 'Member'),
			created_at, updated_at
		FROM users WHERE username = ?
	`

	user := &User{}
	err := s.db.QueryRow(query, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.AvatarPublicID,
		&user.BannerURL,
		&user.BannerPublicID,
		&user.DisplayName,
		&user.Bio,
		&user.Role,
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
		SELECT id, username, password_hash,
			COALESCE(avatar_url, ''), COALESCE(avatar_public_id, ''),
			COALESCE(banner_url, ''), COALESCE(banner_public_id, ''),
			COALESCE(display_name, ''), COALESCE(bio, ''),
			COALESCE(role, 'Member'),
			created_at, updated_at
		FROM users WHERE id = ?
	`

	user := &User{}
	err := s.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.AvatarPublicID,
		&user.BannerURL,
		&user.BannerPublicID,
		&user.DisplayName,
		&user.Bio,
		&user.Role,
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
			avatar_public_id = ?,
			banner_url = ?,
			banner_public_id = ?,
			display_name = ?,
			bio = ?,
			updated_at = ?
		WHERE id = ?
	`

	result, err := s.db.Exec(query,
		user.AvatarURL,
		user.AvatarPublicID,
		user.BannerURL,
		user.BannerPublicID,
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

// UpdateAvatar updates user avatar and returns the previous avatar public ID for cleanup
func (s *Store) UpdateAvatar(userID, avatarURL, avatarPublicID string) (string, error) {
	u, err := s.GetUserByID(userID)
	if err != nil {
		return "", err
	}
	oldPublicID := u.AvatarPublicID

	query := `
		UPDATE users SET
			avatar_url = ?,
			avatar_public_id = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	_, err = s.db.Exec(query, avatarURL, avatarPublicID, userID)
	if err != nil {
		return "", err
	}

	return oldPublicID, nil
}

// UpdateBanner updates user banner and returns the previous banner public ID for cleanup
func (s *Store) UpdateBanner(userID, bannerURL, bannerPublicID string) (string, error) {
	u, err := s.GetUserByID(userID)
	if err != nil {
		return "", err
	}
	oldPublicID := u.BannerPublicID

	query := `
		UPDATE users SET
			banner_url = ?,
			banner_public_id = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	_, err = s.db.Exec(query, bannerURL, bannerPublicID, userID)
	if err != nil {
		return "", err
	}

	return oldPublicID, nil
}

// ListUsers retrieves all users
func (s *Store) ListUsers() ([]*User, error) {
	query := `
		SELECT id, username,
			COALESCE(avatar_url, ''), COALESCE(avatar_public_id, ''),
			COALESCE(banner_url, ''), COALESCE(banner_public_id, ''),
			COALESCE(display_name, ''), COALESCE(bio, ''),
			COALESCE(role, 'Member'),
			created_at, updated_at
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
		if err := rows.Scan(
			&u.ID,
			&u.Username,
			&u.AvatarURL,
			&u.AvatarPublicID,
			&u.BannerURL,
			&u.BannerPublicID,
			&u.DisplayName,
			&u.Bio,
			&u.Role,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
}

// UpdateUserRole updates the role for a user
func (s *Store) UpdateUserRole(userID, role string) error {
	query := `UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	result, err := s.db.Exec(query, role, userID)
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

// CountUsers returns total registered users count
func (s *Store) CountUsers() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}


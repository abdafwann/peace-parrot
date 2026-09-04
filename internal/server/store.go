package server

import (
	"database/sql"
	"errors"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/google/uuid"
)

// ErrServerSettingsNotFound indicates server settings row doesn't exist
var ErrServerSettingsNotFound = errors.New("server settings not found")

// ServerSettings represents global server configuration
type ServerSettings struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Description         string    `json:"description"`
	IconURL             string    `json:"iconUrl,omitempty"`
	IconPublicID        string    `json:"iconPublicId,omitempty"`
	OwnerID             string    `json:"ownerId"`
	InviteExpiryDefault int       `json:"inviteExpiryDefault"`
	SlowModeSeconds     int       `json:"slowModeSeconds"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

// BanInfo represents a banned user entry
type BanInfo struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Username  string    `json:"username"`
	AvatarURL string    `json:"avatarUrl,omitempty"`
	BannedBy  string    `json:"bannedBy"`
	CreatedAt time.Time `json:"createdAt"`
}

// Store handles server settings database operations
type Store struct {
	db *database.DB
}

// NewStore creates a new server store and ensures default row exists
func NewStore(db *database.DB) *Store {
	s := &Store{db: db}
	_ = s.ensureDefaultSettings()
	return s
}

func (s *Store) ensureDefaultSettings() error {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM server_settings").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		// Find first admin or owner user
		var ownerID string
		_ = s.db.QueryRow("SELECT id FROM users ORDER BY created_at ASC LIMIT 1").Scan(&ownerID)
		if ownerID == "" {
			ownerID = "system"
		}

		query := `
			INSERT INTO server_settings (id, name, description, icon_url, icon_public_id, owner_id, slow_mode_seconds, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
		_, err = s.db.Exec(query,
			uuid.New().String(),
			"PeaceParrot Lounge",
			"The official community server for PeaceParrot users.",
			"",
			"",
			ownerID,
			0,
			time.Now(),
			time.Now(),
		)
		return err
	}
	return nil
}

// GetServerSettings retrieves the primary server settings
func (s *Store) GetServerSettings() (*ServerSettings, error) {
	_ = s.ensureDefaultSettings()

	query := `
		SELECT id, name, COALESCE(description, ''),
			COALESCE(icon_url, ''), COALESCE(icon_public_id, ''),
			COALESCE(owner_id, ''), COALESCE(invite_expiry_default, 0),
			COALESCE(slow_mode_seconds, 0), created_at, updated_at
		FROM server_settings
		LIMIT 1
	`

	settings := &ServerSettings{}
	err := s.db.QueryRow(query).Scan(
		&settings.ID,
		&settings.Name,
		&settings.Description,
		&settings.IconURL,
		&settings.IconPublicID,
		&settings.OwnerID,
		&settings.InviteExpiryDefault,
		&settings.SlowModeSeconds,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrServerSettingsNotFound
	}
	if err != nil {
		return nil, err
	}

	return settings, nil
}

// UpdateServerSettings updates name, description, and slow mode
func (s *Store) UpdateServerSettings(name, description string, slowModeSeconds int) error {
	query := `
		UPDATE server_settings SET
			name = ?,
			description = ?,
			slow_mode_seconds = ?,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := s.db.Exec(query, name, description, slowModeSeconds)
	return err
}

// UpdateServerIcon updates server icon and returns old public ID
func (s *Store) UpdateServerIcon(iconURL, iconPublicID string) (string, error) {
	settings, err := s.GetServerSettings()
	if err != nil {
		return "", err
	}
	oldPublicID := settings.IconPublicID

	query := `
		UPDATE server_settings SET
			icon_url = ?,
			icon_public_id = ?,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err = s.db.Exec(query, iconURL, iconPublicID)
	if err != nil {
		return "", err
	}

	return oldPublicID, nil
}

// ListBans returns all currently banned users with their username and avatar
func (s *Store) ListBans() ([]*BanInfo, error) {
	query := `
		SELECT b.id, b.user_id, COALESCE(u.username, 'unknown'), COALESCE(u.avatar_url, ''),
			COALESCE(b.banned_by, ''), b.created_at
		FROM bans b
		LEFT JOIN users u ON b.user_id = u.id
		ORDER BY b.created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bans []*BanInfo
	for rows.Next() {
		b := &BanInfo{}
		if err := rows.Scan(
			&b.ID,
			&b.UserID,
			&b.Username,
			&b.AvatarURL,
			&b.BannedBy,
			&b.CreatedAt,
		); err != nil {
			return nil, err
		}
		bans = append(bans, b)
	}

	return bans, rows.Err()
}

// Role represents a user role and permission level
type Role struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Color        string    `json:"color"`
	IconURL      string    `json:"iconUrl,omitempty"`
	IconPublicID string    `json:"iconPublicId,omitempty"`
	Position     int       `json:"position"`
	Permissions  int       `json:"permissions"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// ListRoles returns all roles ordered by position
func (s *Store) ListRoles() ([]*Role, error) {
	query := `SELECT id, name, color, COALESCE(icon_url, ''), COALESCE(icon_public_id, ''), position, permissions, created_at, updated_at FROM roles ORDER BY position ASC`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []*Role
	for rows.Next() {
		r := &Role{}
		if err := rows.Scan(&r.ID, &r.Name, &r.Color, &r.IconURL, &r.IconPublicID, &r.Position, &r.Permissions, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		roles = append(roles, r)
	}
	return roles, rows.Err()
}

// CreateRole creates a new custom role
func (s *Store) CreateRole(name, color, iconURL string, permissions int) (*Role, error) {
	if color == "" {
		color = "#5865F2"
	}
	id := "role-" + uuid.New().String()[:8]
	now := time.Now()

	var maxPos int
	_ = s.db.QueryRow("SELECT COALESCE(MAX(position), 0) FROM roles").Scan(&maxPos)

	query := `
		INSERT INTO roles (id, name, color, icon_url, icon_public_id, position, permissions, created_at, updated_at)
		VALUES (?, ?, ?, ?, '', ?, ?, ?, ?)
	`
	_, err := s.db.Exec(query, id, name, color, iconURL, maxPos+1, permissions, now, now)
	if err != nil {
		return nil, err
	}

	return &Role{
		ID:          id,
		Name:        name,
		Color:       color,
		IconURL:     iconURL,
		Position:    maxPos + 1,
		Permissions: permissions,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// UpdateRole updates an existing role
func (s *Store) UpdateRole(id, name, color, iconURL string, permissions int) (*Role, error) {
	query := `
		UPDATE roles SET name = ?, color = ?, icon_url = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	res, err := s.db.Exec(query, name, color, iconURL, permissions, id)
	if err != nil {
		return nil, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, errors.New("role not found")
	}

	var r Role
	err = s.db.QueryRow("SELECT id, name, color, COALESCE(icon_url, ''), COALESCE(icon_public_id, ''), position, permissions, created_at, updated_at FROM roles WHERE id = ?", id).
		Scan(&r.ID, &r.Name, &r.Color, &r.IconURL, &r.IconPublicID, &r.Position, &r.Permissions, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// UpdateRoleIcon updates a role's uploaded icon URL and public ID, returning the old public ID if any
func (s *Store) UpdateRoleIcon(id, iconURL, iconPublicID string) (string, error) {
	var oldPublicID string
	_ = s.db.QueryRow("SELECT COALESCE(icon_public_id, '') FROM roles WHERE id = ?", id).Scan(&oldPublicID)

	query := `UPDATE roles SET icon_url = ?, icon_public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	res, err := s.db.Exec(query, iconURL, iconPublicID, id)
	if err != nil {
		return "", err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return "", err
	}
	if rows == 0 {
		return "", errors.New("role not found")
	}
	return oldPublicID, nil
}

// DeleteRole deletes a role (preventing default admin deletion)
func (s *Store) DeleteRole(id string) error {
	if id == "role-admin" {
		return errors.New("cannot delete default Admin role")
	}
	query := `DELETE FROM roles WHERE id = ?`
	res, err := s.db.Exec(query, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("role not found")
	}
	return nil
}

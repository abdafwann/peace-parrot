package channel

import (
	"database/sql"
	"errors"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/google/uuid"
)

// ErrChannelNotFound indicates channel doesn't exist
var ErrChannelNotFound = errors.New("channel not found")

// Store handles channel database operations
type Store struct {
	db *database.DB
}

// NewStore creates a new channel store
func NewStore(db *database.DB) *Store {
	return &Store{db: db}
}

// Channel represents a channel in the database
type Channel struct {
	ID        string
	Name      string
	Type      string // "text" or "voice"
	Topic     string
	Position  int
	CreatedBy string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// CreateChannel creates a new channel
func (s *Store) CreateChannel(channel *Channel) error {
	if channel.ID == "" {
		channel.ID = uuid.New().String()
	}
	now := time.Now()
	channel.CreatedAt = now
	channel.UpdatedAt = now

	query := `
		INSERT INTO channels (id, name, type, topic, position, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		channel.ID,
		channel.Name,
		channel.Type,
		channel.Topic,
		channel.Position,
		channel.CreatedBy,
		channel.CreatedAt,
		channel.UpdatedAt,
	)
	return err
}

// GetChannelByID retrieves a channel by ID
func (s *Store) GetChannelByID(id string) (*Channel, error) {
	query := `
		SELECT id, name, type, topic, position, created_by, created_at, updated_at
		FROM channels WHERE id = ?
	`

	channel := &Channel{}
	err := s.db.QueryRow(query, id).Scan(
		&channel.ID,
		&channel.Name,
		&channel.Type,
		&channel.Topic,
		&channel.Position,
		&channel.CreatedBy,
		&channel.CreatedAt,
		&channel.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrChannelNotFound
	}
	if err != nil {
		return nil, err
	}

	return channel, nil
}

// ListChannels retrieves all channels ordered by position
func (s *Store) ListChannels() ([]*Channel, error) {
	query := `
		SELECT id, name, type, topic, position, created_by, created_at, updated_at
		FROM channels ORDER BY position ASC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []*Channel
	for rows.Next() {
		channel := &Channel{}
		if err := rows.Scan(
			&channel.ID,
			&channel.Name,
			&channel.Type,
			&channel.Topic,
			&channel.Position,
			&channel.CreatedBy,
			&channel.CreatedAt,
			&channel.UpdatedAt,
		); err != nil {
			return nil, err
		}
		channels = append(channels, channel)
	}

	return channels, rows.Err()
}

// UpdateChannel updates a channel
func (s *Store) UpdateChannel(channel *Channel) error {
	channel.UpdatedAt = time.Now()

	query := `
		UPDATE channels SET name = ?, type = ?, topic = ?, position = ?, updated_at = ?
		WHERE id = ?
	`

	result, err := s.db.Exec(query,
		channel.Name,
		channel.Type,
		channel.Topic,
		channel.Position,
		channel.UpdatedAt,
		channel.ID,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrChannelNotFound
	}

	return nil
}

// DeleteChannel deletes a channel
func (s *Store) DeleteChannel(id string) error {
	query := `DELETE FROM channels WHERE id = ?`

	result, err := s.db.Exec(query, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrChannelNotFound
	}

	return nil
}

package message

import (
	"database/sql"
	"errors"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/google/uuid"
)

// Constants
const (
	MaxMessageLength = 4000
	DefaultPageSize  = 50
	MaxPageSize      = 100
)

// ErrMessageNotFound indicates message doesn't exist
var ErrMessageNotFound = errors.New("message not found")

// Store handles message database operations
type Store struct {
	db *database.DB
}

// NewStore creates a new message store
func NewStore(db *database.DB) *Store {
	return &Store{db: db}
}

// Message represents a message in the database
type Message struct {
	ID        string
	ChannelID string
	AuthorID  string
	Content   string
	CreatedAt time.Time
	EditedAt  *time.Time
	DeletedAt *time.Time
}

// CreateMessage creates a new message
func (s *Store) CreateMessage(msg *Message) error {
	if msg.ID == "" {
		msg.ID = uuid.New().String()
	}
	now := time.Now()
	msg.CreatedAt = now

	query := `
		INSERT INTO messages (id, channel_id, author_id, content, created_at)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		msg.ID,
		msg.ChannelID,
		msg.AuthorID,
		msg.Content,
		msg.CreatedAt,
	)
	return err
}

// GetMessageByID retrieves a message by ID
func (s *Store) GetMessageByID(id string) (*Message, error) {
	query := `
		SELECT id, channel_id, author_id, content, created_at, edited_at, deleted_at
		FROM messages WHERE id = ?
	`

	msg := &Message{}
	var editedAt, deletedAt sql.NullTime
	err := s.db.QueryRow(query, id).Scan(
		&msg.ID,
		&msg.ChannelID,
		&msg.AuthorID,
		&msg.Content,
		&msg.CreatedAt,
		&editedAt,
		&deletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrMessageNotFound
	}
	if err != nil {
		return nil, err
	}

	if editedAt.Valid {
		msg.EditedAt = &editedAt.Time
	}
	if deletedAt.Valid {
		msg.DeletedAt = &deletedAt.Time
	}

	return msg, nil
}

// ListMessagesByChannel retrieves messages for a channel with pagination
func (s *Store) ListMessagesByChannel(channelID string, beforeID string, limit int) ([]*Message, error) {
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}

	var query string
	var args []interface{}

	if beforeID != "" {
		// Get message ID's created_at to use as cursor
		query = `
			SELECT id, channel_id, author_id, content, created_at, edited_at, deleted_at
			FROM messages
			WHERE channel_id = ? AND id < ?
			ORDER BY created_at DESC
			LIMIT ?
		`
		args = []interface{}{channelID, beforeID, limit}
	} else {
		query = `
			SELECT id, channel_id, author_id, content, created_at, edited_at, deleted_at
			FROM messages
			WHERE channel_id = ?
			ORDER BY created_at DESC
			LIMIT ?
		`
		args = []interface{}{channelID, limit}
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		msg := &Message{}
		var editedAt, deletedAt sql.NullTime
		if err := rows.Scan(
			&msg.ID,
			&msg.ChannelID,
			&msg.AuthorID,
			&msg.Content,
			&msg.CreatedAt,
			&editedAt,
			&deletedAt,
		); err != nil {
			return nil, err
		}
		if editedAt.Valid {
			msg.EditedAt = &editedAt.Time
		}
		if deletedAt.Valid {
			msg.DeletedAt = &deletedAt.Time
		}
		messages = append(messages, msg)
	}

	return messages, rows.Err()
}

// UpdateMessage updates message content
func (s *Store) UpdateMessage(id, content string) error {
	query := `UPDATE messages SET content = ?, edited_at = ? WHERE id = ?`

	result, err := s.db.Exec(query, content, time.Now(), id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrMessageNotFound
	}

	return nil
}

// DeleteMessage soft deletes a message
func (s *Store) DeleteMessage(id string) error {
	query := `UPDATE messages SET deleted_at = ? WHERE id = ?`

	result, err := s.db.Exec(query, time.Now(), id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrMessageNotFound
	}

	return nil
}

// SearchMessages searches messages by content
func (s *Store) SearchMessages(query string, limit int) ([]*Message, error) {
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}

	sqlQuery := `
		SELECT id, channel_id, author_id, content, created_at, edited_at, deleted_at
		FROM messages
		WHERE content LIKE ? AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT ?
	`

	rows, err := s.db.Query(sqlQuery, "%"+query+"%", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		msg := &Message{}
		var editedAt, deletedAt sql.NullTime
		if err := rows.Scan(
			&msg.ID,
			&msg.ChannelID,
			&msg.AuthorID,
			&msg.Content,
			&msg.CreatedAt,
			&editedAt,
			&deletedAt,
		); err != nil {
			return nil, err
		}
		if editedAt.Valid {
			msg.EditedAt = &editedAt.Time
		}
		if deletedAt.Valid {
			msg.DeletedAt = &deletedAt.Time
		}
		messages = append(messages, msg)
	}

	return messages, rows.Err()
}

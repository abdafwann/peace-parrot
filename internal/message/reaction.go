package message

import (
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrReactionNotFound indicates reaction doesn't exist
var ErrReactionNotFound = errors.New("reaction not found")

// Reaction represents a reaction in the database
type Reaction struct {
	ID        string
	MessageID string
	UserID    string
	Emoji     string
	CreatedAt time.Time
}

// AddReaction adds a reaction to a message
func (s *Store) AddReaction(messageID, userID, emoji string) error {
	// Check if reaction already exists
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?)`
	if err := s.db.QueryRow(query, messageID, userID, emoji).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil // Already exists, no-op
	}

	reaction := &Reaction{
		ID:        uuid.New().String(),
		MessageID: messageID,
		UserID:    userID,
		Emoji:     emoji,
		CreatedAt: time.Now(),
	}

	insertQuery := `
		INSERT INTO reactions (id, message_id, user_id, emoji, created_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := s.db.Exec(insertQuery,
		reaction.ID,
		reaction.MessageID,
		reaction.UserID,
		reaction.Emoji,
		reaction.CreatedAt,
	)
	return err
}

// RemoveReaction removes a reaction from a message
func (s *Store) RemoveReaction(messageID, userID, emoji string) error {
	query := `DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`

	result, err := s.db.Exec(query, messageID, userID, emoji)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrReactionNotFound
	}

	return nil
}

// GetReactionsByMessage retrieves all reactions for a message
func (s *Store) GetReactionsByMessage(messageID string) ([]*Reaction, error) {
	query := `
		SELECT id, message_id, user_id, emoji, created_at
		FROM reactions WHERE message_id = ?
	`

	rows, err := s.db.Query(query, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reactions []*Reaction
	for rows.Next() {
		reaction := &Reaction{}
		if err := rows.Scan(
			&reaction.ID,
			&reaction.MessageID,
			&reaction.UserID,
			&reaction.Emoji,
			&reaction.CreatedAt,
		); err != nil {
			return nil, err
		}
		reactions = append(reactions, reaction)
	}

	return reactions, rows.Err()
}

// GetReactionsWithUsers retrieves reactions grouped by emoji with user info
func (s *Store) GetReactionsWithUsers(messageID string) ([]ReactionWithUsers, error) {
	query := `
		SELECT r.emoji, r.user_id, u.username
		FROM reactions r
		JOIN users u ON r.user_id = u.id
		WHERE r.message_id = ?
		ORDER BY r.created_at ASC
	`

	rows, err := s.db.Query(query, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type emojiGroup struct {
		emoji   string
		users   []UserInfo
	}

	groups := make(map[string]*emojiGroup)
	for rows.Next() {
		var emoji, userID, username string
		if err := rows.Scan(&emoji, &userID, &username); err != nil {
			return nil, err
		}

		if _, ok := groups[emoji]; !ok {
			groups[emoji] = &emojiGroup{emoji: emoji, users: []UserInfo{}}
		}
		groups[emoji].users = append(groups[emoji].users, UserInfo{ID: userID, Username: username})
	}

	var result []ReactionWithUsers
	for _, g := range groups {
		result = append(result, ReactionWithUsers{
			Emoji: g.emoji,
			Count: len(g.users),
			Users: g.users,
		})
	}

	return result, rows.Err()
}

// ReactionWithUsers represents reactions grouped by emoji
type ReactionWithUsers struct {
	Emoji string     `json:"emoji"`
	Count int        `json:"count"`
	Users []UserInfo `json:"users"`
}

// UserInfo represents user info for reactions
type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// PinMessage pins a message to a channel
func (s *Store) PinMessage(messageID, pinnedBy string) error {
	// Check if already pinned
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM pinned_messages WHERE message_id = ?)`
	if err := s.db.QueryRow(query, messageID).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil // Already pinned, no-op
	}

	pin := &PinnedMessage{
		ID:        uuid.New().String(),
		MessageID: messageID,
		PinnedBy: pinnedBy,
		PinnedAt: time.Now(),
	}

	insertQuery := `
		INSERT INTO pinned_messages (id, message_id, pinned_by, pinned_at)
		VALUES (?, ?, ?, ?)
	`
	_, err := s.db.Exec(insertQuery, pin.ID, pin.MessageID, pin.PinnedBy, pin.PinnedAt)
	return err
}

// UnpinMessage unpins a message from a channel
func (s *Store) UnpinMessage(messageID string) error {
	query := `DELETE FROM pinned_messages WHERE message_id = ?`

	result, err := s.db.Exec(query, messageID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("message is not pinned")
	}

	return nil
}

// GetPinnedMessages retrieves all pinned messages for a channel
func (s *Store) GetPinnedMessages(channelID string) ([]*Message, error) {
	query := `
		SELECT m.id, m.channel_id, m.author_id, m.content, m.created_at, m.edited_at, m.deleted_at
		FROM messages m
		JOIN pinned_messages p ON m.id = p.message_id
		WHERE m.channel_id = ?
		ORDER BY p.pinned_at DESC
	`

	rows, err := s.db.Query(query, channelID)
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

// PinnedMessage represents a pinned message record
type PinnedMessage struct {
	ID        string
	MessageID string
	PinnedBy  string
	PinnedAt  time.Time
}

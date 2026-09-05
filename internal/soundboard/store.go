package soundboard

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/google/uuid"
)

type Store struct {
	db *database.DB
}

func NewStore(db *database.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List() ([]*SoundboardItem, error) {
	query := `
		SELECT id, name, emoji, category, duration, custom_url, created_by, created_at
		FROM soundboard_items
		ORDER BY created_at ASC
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list soundboard items: %w", err)
	}
	defer rows.Close()

	var items []*SoundboardItem
	for rows.Next() {
		var item SoundboardItem
		var createdBy sql.NullString
		var createdAt string

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Emoji,
			&item.Category,
			&item.Duration,
			&item.CustomURL,
			&createdBy,
			&createdAt,
		); err != nil {
			continue
		}

		if createdBy.Valid {
			item.CreatedBy = &createdBy.String
		}

		if t, err := time.Parse(time.RFC3339, createdAt); err == nil {
			item.CreatedAt = t
		} else if t2, err2 := time.Parse("2006-01-02 15:04:05", createdAt); err2 == nil {
			item.CreatedAt = t2
		} else if t3, err3 := time.Parse("2006-01-02T15:04:05Z07:00", createdAt); err3 == nil {
			item.CreatedAt = t3
		}

		items = append(items, &item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating soundboard items: %w", err)
	}

	if items == nil {
		items = []*SoundboardItem{}
	}

	return items, nil
}

func (s *Store) Create(req *CreateSoundboardItemRequest, userID *string) (*SoundboardItem, error) {
	id := fmt.Sprintf("custom-%s", uuid.New().String())
	emoji := req.Emoji
	if emoji == "" {
		emoji = "🎵"
	}
	duration := req.Duration
	if duration == "" {
		duration = "SFX"
	}

	now := time.Now().UTC()
	query := `
		INSERT INTO soundboard_items (id, name, emoji, category, duration, custom_url, created_by, created_at)
		VALUES (?, ?, ?, 'custom', ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, id, req.Name, emoji, duration, req.CustomURL, userID, now.Format(time.RFC3339))
	if err != nil {
		return nil, fmt.Errorf("failed to insert soundboard item: %w", err)
	}

	return &SoundboardItem{
		ID:        id,
		Name:      req.Name,
		Emoji:     emoji,
		Category:  "custom",
		Duration:  duration,
		CustomURL: req.CustomURL,
		CreatedBy: userID,
		CreatedAt: now,
	}, nil
}

func (s *Store) Delete(id string) error {
	query := `DELETE FROM soundboard_items WHERE id = ?`
	res, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete soundboard item: %w", err)
	}
	rowsAff, err := res.RowsAffected()
	if err == nil && rowsAff == 0 {
		return fmt.Errorf("soundboard item not found")
	}
	return nil
}

func (s *Store) GetByID(id string) (*SoundboardItem, error) {
	query := `
		SELECT id, name, emoji, category, duration, custom_url, created_by, created_at
		FROM soundboard_items
		WHERE id = ?
	`
	var item SoundboardItem
	var createdBy sql.NullString
	var createdAt string

	err := s.db.QueryRow(query, id).Scan(
		&item.ID,
		&item.Name,
		&item.Emoji,
		&item.Category,
		&item.Duration,
		&item.CustomURL,
		&createdBy,
		&createdAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get soundboard item: %w", err)
	}

	if createdBy.Valid {
		item.CreatedBy = &createdBy.String
	}

	if t, err := time.Parse(time.RFC3339, createdAt); err == nil {
		item.CreatedAt = t
	} else if t2, err2 := time.Parse("2006-01-02 15:04:05", createdAt); err2 == nil {
		item.CreatedAt = t2
	}

	return &item, nil
}

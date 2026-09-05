package invite

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/google/uuid"
)

var (
	ErrInviteNotFound = errors.New("invite code not found")
	ErrInviteUsed     = errors.New("invite code has already been used")
	ErrInviteExpired  = errors.New("invite code has expired")
)

type Invite struct {
	ID        string     `json:"id"`
	Code      string     `json:"code"`
	CreatedBy string     `json:"createdBy"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	Used      bool       `json:"used"`
	UsedBy    *string    `json:"usedBy,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

type Store struct {
	db *database.DB
}

func NewStore(db *database.DB) *Store {
	return &Store{db: db}
}

// generateRandomCode creates an 8-character readable code (e.g. PEAK-7X9B)
func generateRandomCode() (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 8)
	for i := range b {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		b[i] = charset[num.Int64()]
	}
	return fmt.Sprintf("%s-%s", string(b[:4]), string(b[4:])), nil
}

func (s *Store) CreateInvite(createdBy string, durationHours int) (*Invite, error) {
	code, err := generateRandomCode()
	if err != nil {
		return nil, fmt.Errorf("failed to generate invite code: %w", err)
	}

	inv := &Invite{
		ID:        uuid.New().String(),
		Code:      code,
		CreatedBy: createdBy,
		Used:      false,
		CreatedAt: time.Now(),
	}

	if durationHours > 0 {
		exp := time.Now().Add(time.Duration(durationHours) * time.Hour)
		inv.ExpiresAt = &exp
	}

	query := `
		INSERT INTO invites (id, code, created_by, expires_at, used, created_at)
		VALUES (?, ?, ?, ?, 0, ?)
	`
	_, err = s.db.Exec(query, inv.ID, inv.Code, inv.CreatedBy, inv.ExpiresAt, inv.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert invite: %w", err)
	}

	return inv, nil
}

func (s *Store) GetInviteByCode(code string) (*Invite, error) {
	cleanCode := strings.TrimSpace(strings.ToUpper(code))
	query := `
		SELECT id, code, created_by, expires_at, used, used_by, created_at
		FROM invites
		WHERE UPPER(code) = UPPER(?)
	`
	row := s.db.QueryRow(query, cleanCode)

	var inv Invite
	var usedInt int
	var expiresAt, usedBy sql.NullString
	var createdAt string

	err := row.Scan(&inv.ID, &inv.Code, &inv.CreatedBy, &expiresAt, &usedInt, &usedBy, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInviteNotFound
		}
		return nil, fmt.Errorf("failed to query invite: %w", err)
	}

	inv.Used = usedInt == 1
	if expiresAt.Valid {
		t, err := time.Parse(time.RFC3339, expiresAt.String)
		if err == nil {
			inv.ExpiresAt = &t
		} else {
			t2, err2 := time.Parse("2006-01-02 15:04:05", expiresAt.String)
			if err2 == nil {
				inv.ExpiresAt = &t2
			}
		}
	}
	if usedBy.Valid {
		inv.UsedBy = &usedBy.String
	}
	tCreated, err := time.Parse(time.RFC3339, createdAt)
	if err == nil {
		inv.CreatedAt = tCreated
	} else {
		t2, _ := time.Parse("2006-01-02 15:04:05", createdAt)
		inv.CreatedAt = t2
	}

	return &inv, nil
}

func (s *Store) ValidateCode(code string) (*Invite, error) {
	inv, err := s.GetInviteByCode(code)
	if err != nil {
		return nil, err
	}

	if inv.Used {
		return nil, ErrInviteUsed
	}

	if inv.ExpiresAt != nil && inv.ExpiresAt.Before(time.Now()) {
		return nil, ErrInviteExpired
	}

	return inv, nil
}

func (s *Store) MarkUsed(code string, usedBy string) error {
	cleanCode := strings.TrimSpace(strings.ToUpper(code))
	query := `
		UPDATE invites
		SET used = 1, used_by = ?
		WHERE UPPER(code) = UPPER(?)
	`
	res, err := s.db.Exec(query, usedBy, cleanCode)
	if err != nil {
		return fmt.Errorf("failed to mark invite as used: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrInviteNotFound
	}
	return nil
}

func (s *Store) ListInvites() ([]*Invite, error) {
	query := `
		SELECT id, code, created_by, expires_at, used, used_by, created_at
		FROM invites
		ORDER BY created_at DESC
		LIMIT 100
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list invites: %w", err)
	}
	defer rows.Close()

	var list []*Invite
	for rows.Next() {
		var inv Invite
		var usedInt int
		var expiresAt, usedBy sql.NullString
		var createdAt string

		if err := rows.Scan(&inv.ID, &inv.Code, &inv.CreatedBy, &expiresAt, &usedInt, &usedBy, &createdAt); err != nil {
			continue
		}
		inv.Used = usedInt == 1
		if expiresAt.Valid {
			if t, err := time.Parse(time.RFC3339, expiresAt.String); err == nil {
				inv.ExpiresAt = &t
			} else if t2, err2 := time.Parse("2006-01-02 15:04:05", expiresAt.String); err2 == nil {
				inv.ExpiresAt = &t2
			}
		}
		if usedBy.Valid {
			inv.UsedBy = &usedBy.String
		}
		if t, err := time.Parse(time.RFC3339, createdAt); err == nil {
			inv.CreatedAt = t
		} else if t2, err2 := time.Parse("2006-01-02 15:04:05", createdAt); err2 == nil {
			inv.CreatedAt = t2
		}
		list = append(list, &inv)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating invites: %w", err)
	}

	return list, nil
}

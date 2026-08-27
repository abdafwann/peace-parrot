package testing

import (
	"testing"

	"github.com/abdafwann/peace-parrot/internal/auth"
)

func TestValidateUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		wantErr  bool
	}{
		// Valid usernames
		{"valid simple", "afwan123", false},
		{"valid with underscore", "peace_parrot", false},
		{"valid with numbers", "user123", false},
		{"valid 3 chars", "abc", false},
		{"valid 31 chars", "abcdefghijklmnopqrstuvwxyz123456", false}, // 31 total

		// Invalid usernames
		{"too short", "ab", true},
		{"too long", "abcdefghijklmnopqrstuvwxyz12345678", true},
		{"starts with number", "123abc", true},
		{"starts with underscore", "_afwan", true},
		{"contains space", "afwan 123", true},
		{"contains hyphen", "afwan-123", true},
		{"double underscore", "afwan__123", true},
		{"uppercase", "AFWAN", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := auth.ValidateUsername(tt.username)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateUsername(%q) error = %v, wantErr %v", tt.username, err, tt.wantErr)
			}
		})
	}
}

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		// Valid passwords
		{"valid with symbol", "Test@1234", false},
		{"valid long", "MySecretPassword!123", false},
		{"valid simple", "Pass@word1", false},

		// Invalid passwords
		{"too short", "Pass@1", true},
		{"no letter", "12345678!", true},
		{"no number", "Password!", true},
		{"no symbol", "Password123", true},
		{"empty", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := auth.ValidatePassword(tt.password)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePassword() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConstantTimeCompare(t *testing.T) {
	tests := []struct {
		a    string
		b    string
		want bool
	}{
		{"hello", "hello", true},
		{"hello", "world", false},
		{"", "", true},
		{"hello", "", false},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			if got := auth.ConstantTimeCompare(tt.a, tt.b); got != tt.want {
				t.Errorf("ConstantTimeCompare(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

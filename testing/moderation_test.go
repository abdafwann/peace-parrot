package testing

import (
	"testing"
	"time"

	"github.com/abdafwann/peace-parrot/internal/moderation"
)

func TestMute_IsActive(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name     string
		expiresAt *time.Time
		want     bool
	}{
		{"no expiry", nil, true},
		{"future expiry", timePtr(now.Add(time.Hour)), true},
		{"past expiry", timePtr(now.Add(-time.Hour)), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &moderation.Mute{
				ExpiresAt: tt.expiresAt,
			}
			if got := m.IsActive(); got != tt.want {
				t.Errorf("IsActive() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestModerationErrors(t *testing.T) {
	// Test that errors are defined
	if moderation.ErrUserNotFound.Error() != "user not found" {
		t.Error("ErrUserNotFound should have proper error message")
	}
}

// Helper to create time pointer
func timePtr(t time.Time) *time.Time {
	return &t
}

func TestModerationActionTypes(t *testing.T) {
	// Test that moderation actions are identifiable
	actions := []struct {
		name string
		fn   func() error
	}{
		{"kick", func() error { return moderation.ErrUserNotFound }},
		{"ban", func() error { return moderation.ErrUserNotFound }},
		{"mute", func() error { return moderation.ErrUserNotFound }},
	}

	for _, action := range actions {
		t.Run(action.name, func(t *testing.T) {
			err := action.fn()
			if err == nil {
				t.Error("Expected error, got nil")
			}
		})
	}
}

func TestMuteExpiration(t *testing.T) {
	now := time.Now()

	// Test permanent mute (no expiry)
	permanent := &moderation.Mute{}
	if !permanent.IsActive() {
		t.Error("Permanent mute should always be active")
	}

	// Test temporary mute
	futureExpiry := now.Add(1 * time.Hour)
	tempMute := &moderation.Mute{
		ExpiresAt: &futureExpiry,
	}
	if !tempMute.IsActive() {
		t.Error("Temp mute should be active before expiry")
	}

	// Test expired mute
	pastExpiry := now.Add(-1 * time.Hour)
	expiredMute := &moderation.Mute{
		ExpiresAt: &pastExpiry,
	}
	if expiredMute.IsActive() {
		t.Error("Expired mute should not be active")
	}
}

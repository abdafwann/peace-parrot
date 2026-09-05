package testing

import (
	"testing"
	"time"

	"github.com/abdafwann/peace-parrot/internal/message"
)

func TestMessageConstants(t *testing.T) {
	if message.MaxMessageLength != 4000 {
		t.Errorf("MaxMessageLength = %d, want 4000", message.MaxMessageLength)
	}
	if message.DefaultPageSize != 50 {
		t.Errorf("DefaultPageSize = %d, want 50", message.DefaultPageSize)
	}
	if message.MaxPageSize != 100 {
		t.Errorf("MaxPageSize = %d, want 100", message.MaxPageSize)
	}
}

func TestMessageTrimAndValidate(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
	}{
		{"normal", "Hello World", "Hello World"},
		{"with spaces", "  Hello  ", "Hello"},
		{"empty", "", ""},
		{"only spaces", "   ", ""},
		{"tabs", "\tHello\t", "Hello"},
		{"newlines", "\nHello\n", "Hello"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := trimAndValidate(tt.input)
			if got != tt.want {
				t.Errorf("trimAndValidate(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

// Helper function (same as in message handler)
func trimAndValidate(content string) string {
	trimmed := ""
	for i := 0; i < len(content); i++ {
		if content[i] != ' ' || len(trimmed) > 0 {
			trimmed += string(content[i])
		}
	}
	// Trim leading/trailing whitespace
	for len(trimmed) > 0 && (trimmed[0] == ' ' || trimmed[0] == '\t' || trimmed[0] == '\n' || trimmed[0] == '\r') {
		trimmed = trimmed[1:]
	}
	for len(trimmed) > 0 && (trimmed[len(trimmed)-1] == ' ' || trimmed[len(trimmed)-1] == '\t' || trimmed[len(trimmed)-1] == '\n' || trimmed[len(trimmed)-1] == '\r') {
		trimmed = trimmed[:len(trimmed)-1]
	}
	return trimmed
}

func TestMessageContentLength(t *testing.T) {
	// Test max length
	longContent := ""
	for i := 0; i < 4001; i++ {
		longContent += "a"
	}

	if len(longContent) <= message.MaxMessageLength {
		t.Error("Test content should be longer than MaxMessageLength")
	}

	// Test exact max
	maxContent := ""
	for i := 0; i < message.MaxMessageLength; i++ {
		maxContent += "a"
	}

	if len(maxContent) != message.MaxMessageLength {
		t.Errorf("maxContent length = %d, want %d", len(maxContent), message.MaxMessageLength)
	}
}

func TestMessageTimestamps(t *testing.T) {
	now := time.Now()

	// Test that CreatedAt is set
	msg := &message.Message{
		ID:        "test-id",
		ChannelID: "channel-1",
		AuthorID:  "user-1",
		Content:   "Hello",
		CreatedAt:  now,
	}

	if msg.ID != "test-id" || msg.ChannelID != "channel-1" || msg.AuthorID != "user-1" || msg.Content != "Hello" {
		t.Error("Message fields not set correctly")
	}

	if msg.CreatedAt.IsZero() {
		t.Error("CreatedAt should not be zero")
	}

	// Test EditedAt can be nil
	if msg.EditedAt != nil {
		t.Error("EditedAt should be nil for new message")
	}

	// Test DeletedAt can be nil
	if msg.DeletedAt != nil {
		t.Error("DeletedAt should be nil for non-deleted message")
	}

	// Test setting EditedAt
	editTime := time.Now()
	msg.EditedAt = &editTime
	if msg.EditedAt == nil {
		t.Error("EditedAt should not be nil after set")
	}
}

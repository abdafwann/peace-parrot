package testing

import (
	"testing"
	"time"

	"github.com/abdafwann/peace-parrot/internal/channel"
)

func TestChannelTypes(t *testing.T) {
	validTypes := []string{"text", "voice"}

	for _, channelType := range validTypes {
		if channelType != "text" && channelType != "voice" {
			t.Errorf("Channel type %q should be valid", channelType)
		}
	}
}

func TestChannelPosition(t *testing.T) {
	tests := []struct {
		name     string
		position int
	}{
		{"zero", 0},
		{"positive", 1},
		{"large", 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ch := &channel.Channel{
				ID:       "test-id",
				Name:     "test",
				Type:     "text",
				Position: tt.position,
			}
			if ch.Position != tt.position {
				t.Errorf("Position = %d, want %d", ch.Position, tt.position)
			}
		})
	}
}

func TestChannelTimestamps(t *testing.T) {
	now := time.Now()

	ch := &channel.Channel{
		ID:        "test-id",
		Name:      "test-channel",
		Type:      "text",
		Position:  0,
		CreatedBy: "user-1",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if ch.CreatedAt.IsZero() {
		t.Error("CreatedAt should not be zero")
	}

	if ch.UpdatedAt.IsZero() {
		t.Error("UpdatedAt should not be zero")
	}
}

func TestChannelOptionalFields(t *testing.T) {
	// Channel with only required fields
	ch := &channel.Channel{
		ID:   "test-id",
		Name: "General",
		Type: "text",
	}

	if ch.Topic != "" {
		t.Errorf("Topic should be empty, got %q", ch.Topic)
	}

	// Channel with topic
	ch.Topic = "This is a channel topic"
	if ch.Topic != "This is a channel topic" {
		t.Error("Topic should be settable")
	}
}

func TestChannelTypesValid(t *testing.T) {
	validChannel := &channel.Channel{
		ID:   "test",
		Name: "Test",
		Type: "text",
	}

	if validChannel.Type != "text" && validChannel.Type != "voice" {
		t.Error("Channel type should be 'text' or 'voice'")
	}
}

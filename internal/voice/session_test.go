package voice

import (
	"testing"
)

func TestVoiceSessionManager_Join(t *testing.T) {
	mgr := NewVoiceSessionManager()

	// Join a channel
	p := mgr.Join("channel1", "user1")

	if p.UserID != "user1" {
		t.Errorf("expected user1, got %s", p.UserID)
	}
	if p.SelfMuted {
		t.Error("expected selfMuted to be false")
	}
	if p.ServerMuted {
		t.Error("expected serverMuted to be false")
	}
}

func TestVoiceSessionManager_MultipleJoin(t *testing.T) {
	mgr := NewVoiceSessionManager()

	// Multiple users join same channel
	mgr.Join("channel1", "user1")
	mgr.Join("channel1", "user2")

	participants := mgr.GetParticipants("channel1")
	if len(participants) != 2 {
		t.Errorf("expected 2 participants, got %d", len(participants))
	}

	// Same user joining again returns existing
	_ = mgr.Join("channel1", "user1")

	participants = mgr.GetParticipants("channel1")
	if len(participants) != 2 {
		t.Errorf("expected 2 participants after rejoin, got %d", len(participants))
	}
}

func TestVoiceSessionManager_Leave(t *testing.T) {
	mgr := NewVoiceSessionManager()

	// Join then leave
	mgr.Join("channel1", "user1")
	mgr.Join("channel1", "user2")

	left := mgr.Leave("channel1", "user1")
	if !left {
		t.Error("expected leave to return true")
	}

	participants := mgr.GetParticipants("channel1")
	if len(participants) != 1 {
		t.Errorf("expected 1 participant, got %d", len(participants))
	}

	// Leave non-existent
	left = mgr.Leave("channel1", "user1")
	if left {
		t.Error("expected leave of non-existent user to return false")
	}
}

func TestVoiceSessionManager_LeaveEmptyChannel(t *testing.T) {
	mgr := NewVoiceSessionManager()

	mgr.Join("channel1", "user1")
	mgr.Leave("channel1", "user1")

	// Channel should be cleaned up
	participants := mgr.GetParticipants("channel1")
	if len(participants) != 0 {
		t.Errorf("expected empty channel, got %d participants", len(participants))
	}
}

func TestVoiceSessionManager_UpdateState(t *testing.T) {
	mgr := NewVoiceSessionManager()

	mgr.Join("channel1", "user1")

	// Update state
	p, ok := mgr.UpdateState("channel1", "user1", true, false)
	if !ok {
		t.Fatal("expected update to succeed")
	}

	if !p.SelfMuted {
		t.Error("expected selfMuted to be true")
	}
	if p.Deafened {
		t.Error("expected deafened to be false")
	}

	// Update again
	p, ok = mgr.UpdateState("channel1", "user1", false, true)
	if !ok {
		t.Fatal("expected update to succeed")
	}

	if p.SelfMuted {
		t.Error("expected selfMuted to be false")
	}
	if !p.Deafened {
		t.Error("expected deafened to be true")
	}
}

func TestVoiceSessionManager_MuteUser(t *testing.T) {
	mgr := NewVoiceSessionManager()

	mgr.Join("channel1", "user1")

	// Mute user
	p, ok := mgr.MuteUser("channel1", "user1")
	if !ok {
		t.Fatal("expected mute to succeed")
	}

	if !p.ServerMuted {
		t.Error("expected serverMuted to be true")
	}
	if p.CanSpeak() {
		t.Error("expected user to not be able to speak")
	}

	// Unmute user
	p, ok = mgr.UnmuteUser("channel1", "user1")
	if !ok {
		t.Fatal("expected unmute to succeed")
	}

	if p.ServerMuted {
		t.Error("expected serverMuted to be false")
	}
	if !p.CanSpeak() {
		t.Error("expected user to be able to speak")
	}
}

func TestVoiceSessionManager_CanSpeak(t *testing.T) {
	p := &VoiceParticipant{
		UserID:      "user1",
		SelfMuted:   false,
		ServerMuted: false,
	}

	if !p.CanSpeak() {
		t.Error("expected to be able to speak")
	}

	p.SelfMuted = true
	if p.CanSpeak() {
		t.Error("expected not to be able to speak when self muted")
	}

	p.SelfMuted = false
	p.ServerMuted = true
	if p.CanSpeak() {
		t.Error("expected not to be able to speak when server muted")
	}
}

func TestVoiceSessionManager_GetUserChannels(t *testing.T) {
	mgr := NewVoiceSessionManager()

	// User in multiple channels
	mgr.Join("channel1", "user1")
	mgr.Join("channel2", "user1")
	mgr.Join("voice1", "user1")

	channels := mgr.GetUserChannels("user1")
	if len(channels) != 3 {
		t.Errorf("expected 3 channels, got %d", len(channels))
	}
}

func TestVoiceSessionManager_RemoveUserFromAll(t *testing.T) {
	mgr := NewVoiceSessionManager()

	mgr.Join("channel1", "user1")
	mgr.Join("channel2", "user1")
	mgr.Join("voice1", "user2")

	leftChannels := mgr.RemoveUserFromAll("user1")

	if len(leftChannels) != 2 {
		t.Errorf("expected 2 left channels, got %d", len(leftChannels))
	}

	// user1 should not be in any channel
	channels := mgr.GetUserChannels("user1")
	if len(channels) != 0 {
		t.Errorf("expected 0 channels for user1, got %d", len(channels))
	}

	// user2 should still be in voice1
	channels = mgr.GetUserChannels("user2")
	if len(channels) != 1 {
		t.Errorf("expected 1 channel for user2, got %d", len(channels))
	}
}

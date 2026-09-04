package voice

import (
	"sync"
	"time"
)

// VoiceParticipant represents a user in a voice session
type VoiceParticipant struct {
	UserID          string    `json:"user_id"`
	Username        string    `json:"username,omitempty"`
	DisplayName     string    `json:"display_name,omitempty"`
	SelfMuted       bool      `json:"self_muted"`
	ServerMuted     bool      `json:"server_muted"`
	Deafened        bool      `json:"deafened"`
	IsScreenSharing bool      `json:"is_screen_sharing"`
	JoinedAt        time.Time `json:"joined_at"`
}

// CanSpeak returns true if the participant can transmit audio
func (p *VoiceParticipant) CanSpeak() bool {
	return !p.SelfMuted && !p.ServerMuted
}

// VoiceSession represents a voice channel session
type VoiceSession struct {
	ChannelID    string                       `json:"channel_id"`
	Participants map[string]*VoiceParticipant `json:"participants"`
	mu           sync.RWMutex
}

// VoiceSessionManager manages all voice sessions
type VoiceSessionManager struct {
	sessions map[string]*VoiceSession // key: channelID
	mu       sync.RWMutex
}

// NewVoiceSessionManager creates a new voice session manager
func NewVoiceSessionManager() *VoiceSessionManager {
	return &VoiceSessionManager{
		sessions: make(map[string]*VoiceSession),
	}
}

// GetOrCreateSession gets or creates a voice session for a channel
func (m *VoiceSessionManager) GetOrCreateSession(channelID string) *VoiceSession {
	m.mu.Lock()
	defer m.mu.Unlock()

	if session, exists := m.sessions[channelID]; exists {
		return session
	}

	session := &VoiceSession{
		ChannelID:   channelID,
		Participants: make(map[string]*VoiceParticipant),
	}
	m.sessions[channelID] = session
	return session
}

// Join adds a participant to a voice session
func (m *VoiceSessionManager) Join(channelID, userID string) *VoiceParticipant {
	return m.JoinWithUser(channelID, userID, "", "")
}

// JoinWithUser adds a participant with username/displayName to a voice session
func (m *VoiceSessionManager) JoinWithUser(channelID, userID, username, displayName string) *VoiceParticipant {
	session := m.GetOrCreateSession(channelID)

	session.mu.Lock()
	defer session.mu.Unlock()

	// Check if already in session
	if existing, exists := session.Participants[userID]; exists {
		if username != "" {
			existing.Username = username
		}
		if displayName != "" {
			existing.DisplayName = displayName
		}
		return existing
	}

	participant := &VoiceParticipant{
		UserID:      userID,
		Username:    username,
		DisplayName: displayName,
		JoinedAt:    time.Now(),
	}
	session.Participants[userID] = participant
	return participant
}

// Leave removes a participant from a voice session
func (m *VoiceSessionManager) Leave(channelID, userID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, exists := m.sessions[channelID]
	if !exists {
		return false
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if _, existed := session.Participants[userID]; existed {
		delete(session.Participants, userID)

		// Clean up empty sessions
		if len(session.Participants) == 0 {
			delete(m.sessions, channelID)
		}
		return true
	}
	return false
}

// GetParticipant gets a participant from a session
func (m *VoiceSessionManager) GetParticipant(channelID, userID string) (*VoiceParticipant, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[channelID]
	if !exists {
		return nil, false
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	participant, exists := session.Participants[userID]
	return participant, exists
}

// UpdateState updates a participant's state
func (m *VoiceSessionManager) UpdateState(channelID, userID string, selfMuted, deafened bool) (*VoiceParticipant, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, exists := m.sessions[channelID]
	if !exists {
		return nil, false
	}

	participant, exists := session.Participants[userID]
	if !exists {
		return nil, false
	}

	participant.SelfMuted = selfMuted
	participant.Deafened = deafened
	return participant, true
}

// MuteUser sets server-muted state for a participant
func (m *VoiceSessionManager) MuteUser(channelID, userID string) (*VoiceParticipant, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, exists := m.sessions[channelID]
	if !exists {
		return nil, false
	}

	participant, exists := session.Participants[userID]
	if !exists {
		return nil, false
	}

	participant.ServerMuted = true
	return participant, true
}

// UnmuteUser removes server-muted state for a participant
func (m *VoiceSessionManager) UnmuteUser(channelID, userID string) (*VoiceParticipant, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, exists := m.sessions[channelID]
	if !exists {
		return nil, false
	}

	participant, exists := session.Participants[userID]
	if !exists {
		return nil, false
	}

	participant.ServerMuted = false
	return participant, true
}

// GetParticipants gets all participants in a session
func (m *VoiceSessionManager) GetParticipants(channelID string) []*VoiceParticipant {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[channelID]
	if !exists {
		return []*VoiceParticipant{}
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	result := make([]*VoiceParticipant, 0, len(session.Participants))
	for _, p := range session.Participants {
		result = append(result, p)
	}
	return result
}

// GetUserChannels gets all channel IDs a user is in
func (m *VoiceSessionManager) GetUserChannels(userID string) []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var channels []string
	for channelID, session := range m.sessions {
		session.mu.RLock()
		if _, exists := session.Participants[userID]; exists {
			channels = append(channels, channelID)
		}
		session.mu.RUnlock()
	}
	return channels
}

// RemoveUserFromAll removes a user from all sessions
func (m *VoiceSessionManager) RemoveUserFromAll(userID string) []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	var leftChannels []string
	for channelID, session := range m.sessions {
		session.mu.Lock()
		if _, existed := session.Participants[userID]; existed {
			delete(session.Participants, userID)
			leftChannels = append(leftChannels, channelID)

			// Clean up empty sessions
			if len(session.Participants) == 0 {
				delete(m.sessions, channelID)
			}
		}
		session.mu.Unlock()
	}
	return leftChannels
}

// SetScreenSharing updates screen sharing state
func (m *VoiceSessionManager) SetScreenSharing(channelID, userID string, sharing bool) (*VoiceParticipant, bool) {
	m.mu.RLock()
	session, exists := m.sessions[channelID]
	m.mu.RUnlock()

	if !exists {
		return nil, false
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	participant, exists := session.Participants[userID]
	if !exists {
		return nil, false
	}

	participant.IsScreenSharing = sharing
	return participant, true
}

// GetAllSessions returns a snapshot of all active voice sessions
func (m *VoiceSessionManager) GetAllSessions() []*VoiceSession {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sessions := make([]*VoiceSession, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	return sessions
}

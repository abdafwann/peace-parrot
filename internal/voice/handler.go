package voice

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/abdafwann/peace-parrot/internal/channel"
)

// WSEvent represents a WebSocket event
type WSEvent struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// VoiceJoinPayload for voice_join event
type VoiceJoinPayload struct {
	ChannelID    string `json:"channelId"`
	SelfMuted    bool   `json:"selfMuted,omitempty"`
	SelfDeafened bool   `json:"selfDeafened,omitempty"`
}

// VoiceLeavePayload for voice_leave event
type VoiceLeavePayload struct {
	ChannelID string `json:"channelId"`
}

// VoiceStateUpdatePayload for voice_state_update event
type VoiceStateUpdatePayload struct {
	ChannelID    string `json:"channelId"`
	SelfMuted    bool   `json:"selfMuted"`
	SelfDeafened bool   `json:"selfDeafened"`
}

// SpeakingPayload for speaking event
type SpeakingPayload struct {
	ChannelID string `json:"channelId"`
	Speaking  bool   `json:"speaking"`
}

// WebRTC signaling payloads
type WebRTCOfferPayload struct {
	ChannelID string `json:"channelId"`
	SDP       string `json:"sdp"`
}

type WebRTCAnswerPayload struct {
	ChannelID string `json:"channelId"`
	SDP       string `json:"sdp"`
}

type WebRTCICEPayload struct {
	ChannelID     string `json:"channelId,omitempty"`
	Candidate     string `json:"candidate"`
	SDPMid        string `json:"sdpMid"`
	SDPMLineIndex int    `json:"sdpMLineIndex"`
}

// VoiceRoomStatePayload sent to client on join
type VoiceRoomStatePayload struct {
	ChannelID    string              `json:"channelId"`
	Participants []*VoiceParticipant `json:"participants"`
}

// UserJoinedVoicePayload broadcast when user joins
type UserJoinedVoicePayload struct {
	ChannelID string            `json:"channelId"`
	User      *VoiceParticipant `json:"user"`
}

// UserLeftVoicePayload broadcast when user leaves
type UserLeftVoicePayload struct {
	ChannelID string `json:"channelId"`
	UserID    string `json:"userId"`
}

// VoiceStateUpdateBroadcastPayload broadcast state changes
type VoiceStateUpdateBroadcastPayload struct {
	ChannelID    string `json:"channelId"`
	UserID       string `json:"userId"`
	SelfMuted    bool   `json:"selfMuted"`
	SelfDeafened bool   `json:"selfDeafened"`
}

// UserMutedPayload broadcast when admin mutes user
type UserMutedPayload struct {
	ChannelID string `json:"channelId"`
	UserID    string `json:"userId"`
	Muted     bool   `json:"muted"`
}

// SpeakingBroadcastPayload broadcast speaking state
type SpeakingBroadcastPayload struct {
	ChannelID string `json:"channelId"`
	UserID    string `json:"userId"`
	Speaking  bool   `json:"speaking"`
}

// BroadcastFunc is called to send events to clients
type BroadcastFunc func(userIDs []string, eventType string, payload interface{})

// BroadcastAllFunc is called to broadcast events to all clients
type BroadcastAllFunc func(eventType string, payload interface{})

// Handler handles voice WebSocket events
type Handler struct {
	manager        *VoiceSessionManager
	sfu            *SFUEngine
	broadcastFn    BroadcastFunc
	broadcastAllFn BroadcastAllFunc
	muteChecker    interface{ IsUserMuted(string) (bool, error) }
	banChecker     interface{ IsUserBanned(string) (bool, error) }
	voiceAccess    interface{ VoiceAllowed(string) (bool, error) }
	channelChecker interface {
		GetChannelByID(string) (*channel.Channel, error)
	}
	moderationMu sync.Mutex
	eventMu      sync.Mutex
}

func (h *Handler) SetVoiceAccessChecker(checker interface{ VoiceAllowed(string) (bool, error) }) {
	h.voiceAccess = checker
}

func (h *Handler) SetBanChecker(checker interface{ IsUserBanned(string) (bool, error) }) {
	h.banChecker = checker
}

func (h *Handler) SetChannelChecker(checker interface {
	GetChannelByID(string) (*channel.Channel, error)
}) {
	h.channelChecker = checker
}

// SetMuteChecker supplies the persistent administrator mute state.
func (h *Handler) SetMuteChecker(checker interface{ IsUserMuted(string) (bool, error) }) {
	h.muteChecker = checker
}

// NewHandler creates a new voice handler
func NewHandler(broadcast BroadcastFunc, broadcastAll BroadcastAllFunc) *Handler {
	h := &Handler{
		manager:        NewVoiceSessionManager(),
		sfu:            NewSFUEngine(),
		broadcastFn:    broadcast,
		broadcastAllFn: broadcastAll,
	}
	h.sfu.SetCanForward(h.canForwardAudio)
	return h
}

func (h *Handler) canForwardAudio(userID string) bool {
	if h.voiceAccess != nil {
		allowed, err := h.voiceAccess.VoiceAllowed(userID)
		return err == nil && allowed
	}
	if h.muteChecker == nil || h.banChecker == nil {
		return false
	}
	banned, err := h.banChecker.IsUserBanned(userID)
	if err != nil || banned {
		return false
	}
	muted, err := h.muteChecker.IsUserMuted(userID)
	return err == nil && !muted
}

// GetManager returns the voice session manager
func (h *Handler) GetManager() *VoiceSessionManager {
	return h.manager
}

// GetSFU returns the SFU engine
func (h *Handler) GetSFU() *SFUEngine {
	return h.sfu
}

func (h *Handler) ValidateVoiceJoin(userID string, p VoiceJoinPayload) error {
	if p.ChannelID == "" {
		return ErrInvalidPayload("channelId is required")
	}
	if h.banChecker == nil {
		return ErrInvalidPayload("ban status unavailable")
	}
	banned, err := h.banChecker.IsUserBanned(userID)
	if err != nil || banned {
		return ErrInvalidPayload("voice access denied")
	}
	if h.channelChecker == nil {
		return ErrInvalidPayload("channel status unavailable")
	}
	ch, err := h.channelChecker.GetChannelByID(p.ChannelID)
	if err != nil || ch == nil || ch.Type != "voice" {
		return ErrInvalidPayload("invalid voice channel")
	}
	if h.muteChecker == nil {
		return ErrInvalidPayload("mute status unavailable")
	}
	return nil
}

// HandleVoiceJoin handles voice_join event
func (h *Handler) HandleVoiceJoin(userID, username string, payload []byte) (interface{}, error) {
	h.eventMu.Lock()
	defer h.eventMu.Unlock()
	var p VoiceJoinPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, err
	}
	if err := h.ValidateVoiceJoin(userID, p); err != nil {
		return nil, err
	}
	h.moderationMu.Lock()
	muted, err := h.muteChecker.IsUserMuted(userID)
	if err != nil {
		h.moderationMu.Unlock()
		return nil, err
	}

	// Join the session
	participant := h.manager.JoinWithUser(p.ChannelID, userID, username, "")
	if muted {
		participant, _ = h.manager.MuteUser(p.ChannelID, userID)
	} else {
		participant, _ = h.manager.UnmuteUser(p.ChannelID, userID)
	}
	if updated, ok := h.manager.UpdateState(p.ChannelID, userID, p.SelfMuted, p.SelfDeafened); ok {
		participant = updated
	}

	// Ensure SFU room exists
	h.sfu.GetOrCreateRoom(p.ChannelID, h.broadcastFn)

	// Get all participants
	participants := h.manager.GetParticipants(p.ChannelID)

	// Broadcast user joined to ALL connected users
	if h.broadcastAllFn != nil {
		h.broadcastAllFn("user_joined_voice", UserJoinedVoicePayload{
			ChannelID: p.ChannelID,
			User:      participant,
		})
	}
	state := VoiceRoomStatePayload{ChannelID: p.ChannelID, Participants: participants}
	if h.broadcastFn != nil {
		h.broadcastFn([]string{userID}, "voice_room_state", state)
	}
	h.moderationMu.Unlock()

	// Return current room state to the joining user
	return state, nil
}

// HandleVoiceLeave handles voice_leave event
func (h *Handler) HandleVoiceLeave(userID string, payload []byte) error {
	h.eventMu.Lock()
	defer h.eventMu.Unlock()
	var p VoiceLeavePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}

	if p.ChannelID == "" {
		return ErrInvalidPayload("channelId is required")
	}
	if _, ok := h.manager.GetParticipant(p.ChannelID, userID); !ok {
		return ErrUserNotInVoice
	}

	// Remove peer from SFU room
	if room := h.sfu.GetRoom(p.ChannelID); room != nil {
		room.RemovePeer(userID)
	}

	// Leave the session
	h.manager.Leave(p.ChannelID, userID)

	// Broadcast user left to ALL connected users
	if h.broadcastAllFn != nil {
		h.broadcastAllFn("user_left_voice", UserLeftVoicePayload{
			ChannelID: p.ChannelID,
			UserID:    userID,
		})
	}

	return nil
}

// HandleWebRTCOffer processes an incoming WebRTC Offer from a user
func (h *Handler) HandleWebRTCOffer(userID string, payload []byte) (interface{}, error) {
	var p WebRTCOfferPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, err
	}

	if p.ChannelID == "" {
		channels := h.manager.GetUserChannels(userID)
		if len(channels) > 0 {
			p.ChannelID = channels[0]
		}
	}

	if p.ChannelID == "" {
		return nil, ErrInvalidPayload("channelId is required")
	}

	if _, ok := h.manager.GetParticipant(p.ChannelID, userID); !ok {
		return nil, ErrUserNotInVoice
	}
	room := h.sfu.GetOrCreateRoom(p.ChannelID, h.broadcastFn)
	answer, err := room.HandleOffer(userID, p.SDP)
	if err != nil {
		return nil, err
	}

	return WebRTCAnswerPayload{
		ChannelID: p.ChannelID,
		SDP:       answer.SDP,
	}, nil
}

// HandleWebRTCAnswer processes an incoming WebRTC Answer from a user (renegotiation)
func (h *Handler) HandleWebRTCAnswer(userID string, payload []byte) error {
	var p WebRTCAnswerPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}

	if p.ChannelID == "" {
		channels := h.manager.GetUserChannels(userID)
		if len(channels) > 0 {
			p.ChannelID = channels[0]
		}
	}

	if p.ChannelID == "" {
		return ErrInvalidPayload("channelId is required")
	}

	if _, ok := h.manager.GetParticipant(p.ChannelID, userID); !ok {
		return ErrUserNotInVoice
	}
	room := h.sfu.GetRoom(p.ChannelID)
	if room == nil {
		return ErrInvalidPayload("voice room not found")
	}

	return room.HandleAnswer(userID, p.SDP)
}

// HandleWebRTCICE processes incoming ICE candidate from user
func (h *Handler) HandleWebRTCICE(userID string, payload []byte) error {
	var p WebRTCICEPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}

	if p.ChannelID == "" {
		channels := h.manager.GetUserChannels(userID)
		if len(channels) > 0 {
			p.ChannelID = channels[0]
		}
	}

	if p.ChannelID == "" {
		return ErrInvalidPayload("channelId is required")
	}

	if _, ok := h.manager.GetParticipant(p.ChannelID, userID); !ok {
		return ErrUserNotInVoice
	}
	room := h.sfu.GetRoom(p.ChannelID)
	if room == nil {
		return ErrInvalidPayload("voice room not found")
	}

	return room.HandleICE(userID, p.Candidate, p.SDPMid, p.SDPMLineIndex)
}

// HandleVoiceStateUpdate handles voice_state_update event
func (h *Handler) HandleVoiceStateUpdate(userID string, payload []byte) error {
	h.eventMu.Lock()
	defer h.eventMu.Unlock()
	var p VoiceStateUpdatePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}

	if p.ChannelID == "" {
		return ErrInvalidPayload("channelId is required")
	}

	// Update state
	participant, ok := h.manager.UpdateState(p.ChannelID, userID, p.SelfMuted, p.SelfDeafened)
	if !ok {
		return ErrUserNotInVoice
	}

	// Broadcast to all connected users
	if h.broadcastAllFn != nil {
		h.broadcastAllFn("voice_state_update", VoiceStateUpdateBroadcastPayload{
			ChannelID:    p.ChannelID,
			UserID:       userID,
			SelfMuted:    participant.SelfMuted,
			SelfDeafened: participant.Deafened,
		})
	}

	return nil
}

// HandleSpeaking handles speaking event
func (h *Handler) HandleSpeaking(userID string, payload []byte) error {
	var p SpeakingPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}

	if p.ChannelID == "" {
		return ErrInvalidPayload("channelId is required")
	}

	// Broadcast to all connected users
	if h.broadcastAllFn != nil {
		h.broadcastAllFn("speaking", SpeakingBroadcastPayload{
			ChannelID: p.ChannelID,
			UserID:    userID,
			Speaking:  p.Speaking,
		})
	}

	return nil
}

// MuteUser handles server-side mute (moderation)
func (h *Handler) MuteUser(channelID, userID string) error {
	participant, ok := h.manager.MuteUser(channelID, userID)
	if !ok {
		return ErrUserNotInVoice
	}

	// Broadcast mute state
	if h.broadcastAllFn != nil {
		h.broadcastAllFn("user_muted", UserMutedPayload{
			ChannelID: channelID,
			UserID:    userID,
			Muted:     participant.ServerMuted,
		})
	}

	log.Printf("Voice: User %s muted by admin in channel %s", userID, channelID)
	return nil
}

// UnmuteUser handles server-side unmute (moderation)
func (h *Handler) UnmuteUser(channelID, userID string) error {
	participant, ok := h.manager.UnmuteUser(channelID, userID)
	if !ok {
		return ErrUserNotInVoice
	}

	// Broadcast unmute state
	if h.broadcastAllFn != nil {
		h.broadcastAllFn("user_muted", UserMutedPayload{
			ChannelID: channelID,
			UserID:    userID,
			Muted:     participant.ServerMuted,
		})
	}

	log.Printf("Voice: User %s unmuted by admin in channel %s", userID, channelID)
	return nil
}

// SetAdminMute updates every active session for an administratively muted user.
func (h *Handler) SetAdminMute(userID string, muted bool) {
	h.eventMu.Lock()
	defer h.eventMu.Unlock()
	h.moderationMu.Lock()
	defer h.moderationMu.Unlock()
	if h.muteChecker != nil {
		current, err := h.muteChecker.IsUserMuted(userID)
		if err != nil {
			return
		}
		muted = current
	}
	for _, channelID := range h.manager.GetUserChannels(userID) {
		if muted {
			_ = h.MuteUser(channelID, userID)
		} else {
			_ = h.UnmuteUser(channelID, userID)
		}
	}
}

// RemoveUser handles user disconnect cleanup
func (h *Handler) RemoveUser(userID string) {
	h.eventMu.Lock()
	defer h.eventMu.Unlock()
	channels := h.manager.RemoveUserFromAll(userID)

	for _, channelID := range channels {
		if room := h.sfu.GetRoom(channelID); room != nil {
			room.RemovePeer(userID)
		}
		if h.broadcastAllFn != nil {
			h.broadcastAllFn("user_left_voice", UserLeftVoicePayload{
				ChannelID: channelID,
				UserID:    userID,
			})
		}
		log.Printf("Voice: User %s disconnected from channel %s", userID, channelID)
	}
}

// SendSnapshots serializes snapshot creation with voice changes and their broadcasts.
func (h *Handler) SendSnapshots(send func(VoiceRoomStatePayload)) {
	h.eventMu.Lock()
	defer h.eventMu.Unlock()
	for _, session := range h.manager.GetAllSessions() {
		participants := h.manager.GetParticipants(session.ChannelID)
		if len(participants) > 0 {
			send(VoiceRoomStatePayload{ChannelID: session.ChannelID, Participants: participants})
		}
	}
}

// GetUserChannels returns channels a user is in
func (h *Handler) GetUserChannels(userID string) []string {
	return h.manager.GetUserChannels(userID)
}

// Helper to get other user IDs in a channel
func getOtherUserIDs(channelID, excludeUserID string, participants []*VoiceParticipant) []string {
	var userIDs []string
	for _, p := range participants {
		if p.UserID != excludeUserID {
			userIDs = append(userIDs, p.UserID)
		}
	}
	return userIDs
}

// Errors
type VoiceError struct {
	Message string
}

func (e VoiceError) Error() string {
	return e.Message
}

func ErrInvalidPayload(msg string) error {
	return VoiceError{Message: msg}
}

var (
	ErrUserNotInVoice = VoiceError{Message: "user is not in a voice session"}
)

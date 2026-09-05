package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/internal/message"
	"github.com/abdafwann/peace-parrot/internal/voice"
	"github.com/abdafwann/peace-parrot/internal/websocket"
	gws "github.com/gorilla/websocket"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

var upgrader = gws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	hub            *websocket.Hub
	voiceHandler   *voice.Handler
	messageHandler *message.Handler
	jwtMgr         *auth.JWTManager
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(hub *websocket.Hub, voiceHandler *voice.Handler, messageHandler *message.Handler, jwtMgr *auth.JWTManager) *WebSocketHandler {
	return &WebSocketHandler{
		hub:            hub,
		voiceHandler:   voiceHandler,
		messageHandler: messageHandler,
		jwtMgr:         jwtMgr,
	}
}

// HandleWebSocket handles incoming WebSocket connections
func (h *WebSocketHandler) HandleWebSocket(c echo.Context) error {
	// Get token from query parameter
	token := c.QueryParam("token")
	if token == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "token required"})
	}

	// Validate JWT token
	claims, err := h.jwtMgr.ValidateToken(token)
	if err != nil {
		log.Printf("WebSocket: Invalid token: %v", err)
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
	}

	userID := claims.UserID
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token: no user ID"})
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		log.Printf("WebSocket: Upgrade failed: %v", err)
		return err
	}

	// Create client
	client := &websocket.Client{
		ID:       generateClientID(),
		UserID:   userID,
		Username: claims.Username,
		Conn:     conn,
		Channels: make(map[string]bool),
	}

	// Register client with hub
	h.hub.Register(client)
	log.Printf("WebSocket: User %s (%s) connected", userID, claims.Username)

	// Send initial active voice room states to newly connected client
	for _, session := range h.voiceHandler.GetManager().GetAllSessions() {
		participants := h.voiceHandler.GetManager().GetParticipants(session.ChannelID)
		if len(participants) > 0 {
			_ = client.SendJSON(websocket.Message{
				Type: "voice_room_state",
				Payload: websocket.MustMarshal(voice.VoiceRoomStatePayload{
					ChannelID:    session.ChannelID,
					Participants: participants,
				}),
			})
		}
	}

	// Start goroutine to read messages
	go h.readPump(client)

	return nil
}

// readPump reads messages from the WebSocket connection
func (h *WebSocketHandler) readPump(client *websocket.Client) {
	defer func() {
		// Cleanup on disconnect
		h.hub.Unregister(client)
		h.voiceHandler.RemoveUser(client.UserID)
		client.Conn.Close()
		log.Printf("WebSocket: User %s disconnected", client.UserID)
	}()

	for {
		_, messageBytes, err := client.Conn.ReadMessage()
		if err != nil {
			if gws.IsUnexpectedCloseError(err, gws.CloseGoingAway, gws.CloseAbnormalClosure) {
				log.Printf("WebSocket: Read error: %v", err)
			}
			break
		}

		// Parse message
		var msg websocket.Message
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("WebSocket: Failed to parse message: %v", err)
			continue
		}

		// Route message to handler
		h.handleMessage(client, &msg)
	}
}

// handleMessage routes messages to appropriate handlers
func (h *WebSocketHandler) handleMessage(client *websocket.Client, msg *websocket.Message) {
	log.Printf("[WS] Route message type=%s from user=%s", msg.Type, client.UserID)

	switch msg.Type {
	case "channel_join":
		// Subscribe client to channel
		result := h.handleChannelJoin(client, msg.Payload, msg.ChannelID)
		if result != nil {
			log.Printf("[WS] Subscribed client to channel: %s", result.ChannelID)
		}

	case "message":
		result, err := h.handleMessageCreate(client, msg.Payload, msg.ChannelID)
		if err != nil {
			log.Printf("Message create error: %v", err)
			return
		}
		// Broadcast to channel
		h.hub.BroadcastToChannel(result.ChannelID, "message", result)

	case "message_edit":
		result, err := h.handleMessageEdit(client.UserID, msg.Payload, msg.ChannelID)
		if err != nil {
			log.Printf("Message edit error: %v", err)
			return
		}
		// Broadcast to channel
		if result != nil {
			h.hub.BroadcastToChannel(result.ChannelID, "message_edit", result)
		}

	case "message_delete":
		result, err := h.handleMessageDelete(client.UserID, msg.Payload, msg.ChannelID)
		if err != nil {
			log.Printf("Message delete error: %v", err)
			return
		}
		// Broadcast to channel
		if result != nil {
			h.hub.BroadcastToChannel(result.ChannelID, "message_delete", result)
		}

	case "reaction_add":
		result, err := h.handleReactionAdd(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("Reaction add error: %v", err)
			return
		}
		if result != nil {
			h.hub.BroadcastToChannel(result.ChannelID, "reaction_add", result)
		}

	case "reaction_remove":
		result, err := h.handleReactionRemove(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("Reaction remove error: %v", err)
			return
		}
		if result != nil {
			h.hub.BroadcastToChannel(result.ChannelID, "reaction_remove", result)
		}

	case "voice_join":
		result, err := h.voiceHandler.HandleVoiceJoin(client.UserID, client.Username, msg.Payload)
		if err != nil {
			log.Printf("Voice join error: %v", err)
			return
		}
		// Send room state back to user
		h.hub.SendToUser(client.UserID, "voice_room_state", result)

	case "voice_leave":
		err := h.voiceHandler.HandleVoiceLeave(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("Voice leave error: %v", err)
		}

	case "voice_state_update":
		err := h.voiceHandler.HandleVoiceStateUpdate(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("Voice state update error: %v", err)
		}

	case "speaking":
		err := h.voiceHandler.HandleSpeaking(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("Speaking error: %v", err)
		}

	case "webrtc_offer":
		result, err := h.voiceHandler.HandleWebRTCOffer(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("[WS] WebRTC offer error: %v", err)
			return
		}
		// Send WebRTC answer back to user
		h.hub.SendToUser(client.UserID, "webrtc_answer", result)

	case "webrtc_answer":
		err := h.voiceHandler.HandleWebRTCAnswer(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("[WS] WebRTC answer error: %v", err)
		}

	case "soundboard_play":
		var payload map[string]interface{}
		_ = json.Unmarshal(msg.Payload, &payload)
		h.hub.BroadcastAll("soundboard_play", map[string]interface{}{
			"soundId":   payload["soundId"],
			"soundName": payload["soundName"],
			"soundUrl":  payload["soundUrl"],
			"channelId": payload["channelId"],
			"userId":    client.UserID,
			"username":  client.Username,
		})

	case "webrtc_ice":
		err := h.voiceHandler.HandleWebRTCICE(client.UserID, msg.Payload)
		if err != nil {
			log.Printf("[WS] WebRTC ICE error: %v", err)
		}

	case "typing_start":
		// Broadcast typing start to channel
		result := h.handleTyping(client, msg.Payload, msg.ChannelID)
		if result != nil {
			h.hub.BroadcastToChannel(result.ChannelID, "typing_start", result)
		}

	case "typing_stop":
		// Broadcast typing stop to channel
		result := h.handleTyping(client, msg.Payload, msg.ChannelID)
		if result != nil {
			h.hub.BroadcastToChannel(result.ChannelID, "typing_stop", result)
		}

	default:
		log.Printf("[WS] Unknown message type: %s", msg.Type)
	}

	// Catch-all log
	log.Printf("[WS] Message processed, type=%s channel=%s", msg.Type, msg.ChannelID)
}

// Message payloads
type MessagePayload struct {
	ChannelID   string               `json:"channelId"`
	Content     string               `json:"content"`
	Attachments []message.Attachment `json:"attachments,omitempty"`
}

type MessageResponse struct {
	ChannelID       string               `json:"channelId"`
	ID              string               `json:"id"`
	AuthorID        string               `json:"authorId"`
	AuthorName      string               `json:"authorName,omitempty"`
	AuthorAvatarURL string               `json:"authorAvatarUrl,omitempty"`
	Content         string               `json:"content"`
	Attachments     []message.Attachment `json:"attachments"`
	CreatedAt       string               `json:"createdAt"`
}

type MessageEditPayload struct {
	MessageID string `json:"messageId"`
	Content   string `json:"content"`
}

type MessageEditResponse struct {
	ChannelID string `json:"channelId"`
	MessageID string `json:"messageId"`
	Content   string `json:"content"`
}

type MessageDeletePayload struct {
	MessageID string `json:"messageId"`
	ChannelID string `json:"channelId"`
}

type MessageDeleteResponse struct {
	ChannelID string `json:"channelId"`
	MessageID string `json:"messageId"`
}

type ChannelJoinPayload struct {
	ChannelID string `json:"channelId"`
}

type ChannelJoinResponse struct {
	ChannelID string `json:"channelId"`
}

type ReactionPayload struct {
	MessageID string `json:"messageId"`
	Emoji     string `json:"emoji"`
	ChannelID string `json:"channelId"`
}

type ReactionResponse struct {
	ChannelID string    `json:"channelId"`
	MessageID string    `json:"messageId"`
	Emoji     string    `json:"emoji"`
	User      *UserInfo `json:"user,omitempty"`
	UserID    string    `json:"userId,omitempty"`
}

type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type TypingPayload struct {
	ChannelID string `json:"channelId"`
}

type TypingResponse struct {
	ChannelID string `json:"channelId"`
	UserID    string `json:"userId"`
	Username  string `json:"username"`
}

// handleMessageCreate creates a message and returns broadcast payload
func (h *WebSocketHandler) handleMessageCreate(client *websocket.Client, payload json.RawMessage, channelIDFromMsg string) (*MessageResponse, error) {
	var msgPayload MessagePayload
	if err := json.Unmarshal(payload, &msgPayload); err != nil {
		log.Printf("[WS] Message create: failed to unmarshal payload: %v", err)
		return nil, err
	}

	if msgPayload.ChannelID == "" {
		msgPayload.ChannelID = channelIDFromMsg
	}

	if msgPayload.ChannelID == "" {
		return nil, fmt.Errorf("channelId is required")
	}
	if msgPayload.Content == "" && len(msgPayload.Attachments) == 0 {
		return nil, fmt.Errorf("content or attachment is required")
	}

	log.Printf("[WS] Creating message: user=%s channel=%s content=%s attachments=%d", client.UserID, msgPayload.ChannelID, msgPayload.Content, len(msgPayload.Attachments))

	// Create message via message handler
	msg, err := h.messageHandler.CreateMessageWithAttachments(msgPayload.ChannelID, client.UserID, msgPayload.Content, msgPayload.Attachments)
	if err != nil {
		log.Printf("[WS] Message create: store error: %v", err)
		return nil, err
	}

	authorName := msg.AuthorName
	if authorName == "" {
		authorName = client.Username
	}
	if authorName == "" {
		authorName = "User"
	}

	attachments := msg.Attachments
	if attachments == nil {
		attachments = []message.Attachment{}
	}

	return &MessageResponse{
		ChannelID:       msg.ChannelID,
		ID:              msg.ID,
		AuthorID:        msg.AuthorID,
		AuthorName:      authorName,
		AuthorAvatarURL: msg.AuthorAvatarURL,
		Content:         msg.Content,
		Attachments:     attachments,
		CreatedAt:       msg.CreatedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}, nil
}

// handleMessageEdit edits a message and returns broadcast payload
func (h *WebSocketHandler) handleMessageEdit(userID string, payload json.RawMessage, channelIDFromMsg string) (*MessageEditResponse, error) {
	var msgPayload MessageEditPayload
	if err := json.Unmarshal(payload, &msgPayload); err != nil {
		return nil, err
	}

	if msgPayload.MessageID == "" {
		return nil, fmt.Errorf("messageId is required")
	}

	msg, err := h.messageHandler.EditMessage(msgPayload.MessageID, userID, msgPayload.Content)
	if err != nil {
		if err == message.ErrMessageNotFound || err == message.ErrNotAuthorized {
			return nil, nil // Silently ignore
		}
		return nil, err
	}

	channelID := msg.ChannelID
	if channelID == "" {
		channelID = channelIDFromMsg
	}

	return &MessageEditResponse{
		ChannelID: channelID,
		MessageID: msg.ID,
		Content:   msg.Content,
	}, nil
}

// handleMessageDelete deletes a message and returns broadcast payload
func (h *WebSocketHandler) handleMessageDelete(userID string, payload json.RawMessage, channelIDFromMsg string) (*MessageDeleteResponse, error) {
	var msgPayload MessageDeletePayload
	if err := json.Unmarshal(payload, &msgPayload); err != nil {
		return nil, err
	}

	if msgPayload.MessageID == "" {
		return nil, fmt.Errorf("messageId is required")
	}

	msg, err := h.messageHandler.DeleteMessage(msgPayload.MessageID, userID)
	if err != nil {
		if err == message.ErrMessageNotFound || err == message.ErrNotAuthorized {
			return nil, nil // Silently ignore
		}
		return nil, err
	}

	channelID := msg.ChannelID
	if channelID == "" {
		channelID = msgPayload.ChannelID
	}
	if channelID == "" {
		channelID = channelIDFromMsg
	}

	return &MessageDeleteResponse{
		ChannelID: channelID,
		MessageID: msg.ID,
	}, nil
}

// handleReactionAdd adds a reaction and returns broadcast payload
func (h *WebSocketHandler) handleReactionAdd(userID string, payload json.RawMessage) (*ReactionResponse, error) {
	var reactPayload ReactionPayload
	if err := json.Unmarshal(payload, &reactPayload); err != nil {
		return nil, err
	}

	if reactPayload.MessageID == "" || reactPayload.Emoji == "" {
		return nil, nil
	}

	// Get username for broadcast
	username := "User"

	return &ReactionResponse{
		ChannelID: reactPayload.ChannelID,
		MessageID: reactPayload.MessageID,
		Emoji:    reactPayload.Emoji,
		User: &UserInfo{
			ID:       userID,
			Username: username,
		},
	}, nil
}

// handleReactionRemove removes a reaction and returns broadcast payload
func (h *WebSocketHandler) handleReactionRemove(userID string, payload json.RawMessage) (*ReactionResponse, error) {
	var reactPayload ReactionPayload
	if err := json.Unmarshal(payload, &reactPayload); err != nil {
		return nil, err
	}

	if reactPayload.MessageID == "" || reactPayload.Emoji == "" {
		return nil, nil
	}

	return &ReactionResponse{
		ChannelID: reactPayload.ChannelID,
		MessageID: reactPayload.MessageID,
		Emoji:    reactPayload.Emoji,
		UserID:   userID,
	}, nil
}

// handleChannelJoin subscribes client to a channel for broadcasts
func (h *WebSocketHandler) handleChannelJoin(client *websocket.Client, payload json.RawMessage, channelIDFromMsg string) *ChannelJoinResponse {
	var joinPayload ChannelJoinPayload
	if err := json.Unmarshal(payload, &joinPayload); err != nil {
		log.Printf("[WS] channel_join: failed to unmarshal: %v", err)
	}

	channelID := joinPayload.ChannelID
	if channelID == "" {
		channelID = channelIDFromMsg
	}

	if channelID == "" {
		return nil
	}

	// Subscribe client to channel
	client.Subscribe(channelID)
	log.Printf("[WS] Client %s (%s) subscribed to channel %s", client.ID, client.Username, channelID)

	return &ChannelJoinResponse{
		ChannelID: channelID,
	}
}

// handleTyping handles typing start/stop
func (h *WebSocketHandler) handleTyping(client *websocket.Client, payload json.RawMessage, channelIDFromMsg string) *TypingResponse {
	var typingPayload TypingPayload
	if err := json.Unmarshal(payload, &typingPayload); err != nil {
		return nil
	}

	channelID := typingPayload.ChannelID
	if channelID == "" {
		channelID = channelIDFromMsg
	}
	if channelID == "" {
		return nil
	}

	username := client.Username
	if username == "" {
		username = "User"
	}

	return &TypingResponse{
		ChannelID: channelID,
		UserID:    client.UserID,
		Username:  username,
	}
}

// generateClientID generates a unique client ID
func generateClientID() string {
	return fmt.Sprintf("client-%s", uuid.New().String())
}

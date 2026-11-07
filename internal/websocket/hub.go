package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// Client represents a WebSocket client
type Client struct {
	ID       string
	UserID   string
	Username string
	Conn     *websocket.Conn
	Channels map[string]bool // subscribed channels
	writeMu  sync.Mutex
	mu       sync.RWMutex
	active   atomic.Bool
}

// SendJSON writes JSON to the client safely with mutex lock
func (c *Client) SendJSON(v interface{}) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.Conn.WriteJSON(v)
}

// Hub manages all WebSocket connections
type Hub struct {
	clients    map[string]*Client
	register   chan registerRequest
	unregister chan *Client
	broadcast  chan *Message
	mu         sync.RWMutex

	// Event handlers
	voiceHandler VoiceHandler
}

type registerRequest struct {
	client *Client
	done   chan struct{}
}

// VoiceHandler interface for voice events
type VoiceHandler interface {
	HandleVoiceJoin(userID, username string, payload []byte) (interface{}, error)
	HandleVoiceLeave(userID string, payload []byte) error
	HandleVoiceStateUpdate(userID string, payload []byte) error
	HandleSpeaking(userID string, payload []byte) error
}

// Message represents a WebSocket message
type Message struct {
	Type           string          `json:"type"`
	ChannelID      string          `json:"channelId,omitempty"`
	Payload        json.RawMessage `json:"payload,omitempty"`
	targetClientID string
	targetUserID   string
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan registerRequest),
		unregister: make(chan *Client),
		broadcast:  make(chan *Message, 256),
	}
}

// PresencePayload represents a presence update event
type PresencePayload struct {
	UserID   string `json:"userId"`
	Username string `json:"username,omitempty"`
	Status   string `json:"status"` // "online" or "offline"
}

// PresenceSyncPayload represents initial online users snapshot
type PresenceSyncPayload struct {
	OnlineUserIDs []string `json:"onlineUserIds"`
}

// SetVoiceHandler sets the voice handler
func (h *Hub) SetVoiceHandler(handler VoiceHandler) {
	h.voiceHandler = handler
}

func (h *Hub) getOnlineUserIDsLocked() []string {
	userSet := make(map[string]bool)
	for _, c := range h.clients {
		if c.UserID != "" && c.active.Load() {
			userSet[c.UserID] = true
		}
	}
	ids := make([]string, 0, len(userSet))
	for id := range userSet {
		ids = append(ids, id)
	}
	return ids
}

// GetOnlineUserIDs returns list of unique user IDs currently connected
func (h *Hub) GetOnlineUserIDs() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.getOnlineUserIDsLocked()
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case request := <-h.register:
			client := request.client
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			close(request.done)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				client.Conn.Close()
				log.Printf("WebSocket: Client %s disconnected", client.ID)

				// Check if user has no remaining active connections
				userID := client.UserID
				hasOtherConnections := false
				for _, c := range h.clients {
					if c.UserID == userID && c.active.Load() {
						hasOtherConnections = true
						break
					}
				}
				h.mu.Unlock()

				if client.active.Load() && !hasOtherConnections && userID != "" {
					h.BroadcastAll("user_presence", PresencePayload{
						UserID:   userID,
						Username: client.Username,
						Status:   "offline",
					})
				}
			} else {
				h.mu.Unlock()
			}

		case message := <-h.broadcast:
			log.Printf("[Hub] Received broadcast message type=%s channel=%s", message.Type, message.ChannelID)
			h.mu.RLock()
			for _, client := range h.clients {
				client.mu.RLock()
				if client.active.Load() && (message.targetClientID == "" || message.targetClientID == client.ID) && (message.targetUserID == "" || message.targetUserID == client.UserID) && (message.ChannelID == "" || client.Channels[message.ChannelID]) {
					if err := client.SendJSON(message); err != nil {
						log.Printf("WebSocket: Error sending to client %s: %v", client.ID, err)
					}
				}
				client.mu.RUnlock()
			}
			h.mu.RUnlock()
		}
	}
}

// QueueToClient orders a targeted event with all other hub broadcasts.
func (h *Hub) QueueToClient(clientID, eventType string, payload interface{}) {
	h.broadcast <- &Message{Type: eventType, Payload: MustMarshal(payload), targetClientID: clientID}
}

// QueueToUser orders a user-targeted event with all other hub broadcasts.
func (h *Hub) QueueToUser(userID, eventType string, payload interface{}) {
	h.broadcast <- &Message{Type: eventType, Payload: MustMarshal(payload), targetUserID: userID}
}

// Register registers a new client
func (h *Hub) Register(client *Client) {
	done := make(chan struct{})
	h.register <- registerRequest{client: client, done: done}
	<-done
}

// Activate publishes presence only after the connection's authorization checks.
func (h *Hub) Activate(client *Client) {
	h.mu.Lock()
	if _, ok := h.clients[client.ID]; !ok {
		h.mu.Unlock()
		return
	}
	client.active.Store(true)
	onlineIDs := h.getOnlineUserIDsLocked()
	h.mu.Unlock()
	_ = client.SendJSON(Message{Type: "presence_sync", Payload: MustMarshal(PresenceSyncPayload{OnlineUserIDs: onlineIDs})})
	h.BroadcastAll("user_presence", PresencePayload{UserID: client.UserID, Username: client.Username, Status: "online"})
}

// Unregister unregisters a client
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// BroadcastChannel sends a message to all clients in a channel
func (h *Hub) BroadcastChannel(channelID, eventType string, payload interface{}) {
	msg := Message{
		Type:      eventType,
		ChannelID: channelID,
		Payload:   MustMarshal(payload),
	}
	log.Printf("[Hub] Broadcasting %s to channel %s", eventType, channelID)
	h.broadcast <- &msg
}

// SendToUser sends a message to a specific user
func (h *Hub) SendToUser(userID, eventType string, payload interface{}) {
	msg := Message{
		Type:    eventType,
		Payload: MustMarshal(payload),
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		if client.UserID == userID && client.active.Load() {
			if err := client.SendJSON(msg); err != nil {
				log.Printf("WebSocket: Error sending to user %s: %v", userID, err)
			}
		}
	}
}

// SendToClient sends an event to a specific active connection.
func (h *Hub) SendToClient(clientID, eventType string, payload interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	client := h.clients[clientID]
	if client != nil && client.active.Load() {
		_ = client.SendJSON(Message{Type: eventType, Payload: MustMarshal(payload)})
	}
}

// DisconnectUser closes every active connection for a user. The read pump
// performs the normal unregister and voice cleanup after the close.
func (h *Hub) DisconnectUser(userID string) {
	h.mu.RLock()
	var clients []*Client
	for _, client := range h.clients {
		if client.UserID == userID {
			clients = append(clients, client)
		}
	}
	h.mu.RUnlock()
	for _, client := range clients {
		_ = client.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "account banned"), time.Now().Add(time.Second))
		_ = client.Conn.Close()
	}
}

// GetClientByUserID gets a client by user ID
func (h *Hub) GetClientByUserID(userID string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		if client.UserID == userID {
			return client
		}
	}
	return nil
}

// GetClientsInChannel gets all clients in a channel
func (h *Hub) GetClientsInChannel(channelID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var clients []*Client
	for _, client := range h.clients {
		client.mu.RLock()
		if client.Channels[channelID] {
			clients = append(clients, client)
		}
		client.mu.RUnlock()
	}
	return clients
}

// Subscribe subscribes a client to a channel
func (c *Client) Subscribe(channelID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Channels[channelID] = true
}

// Unsubscribe unsubscribes a client from a channel
func (c *Client) Unsubscribe(channelID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.Channels, channelID)
}

// BroadcastToChannel broadcasts to a channel with a payload
func (h *Hub) BroadcastToChannel(channelID, eventType string, payload interface{}) {
	msg := Message{
		Type:      eventType,
		ChannelID: channelID,
		Payload:   MustMarshal(payload),
	}
	log.Printf("[Hub] Queuing broadcast %s to channel %s", eventType, channelID)
	h.broadcast <- &msg
	log.Printf("[Hub] Queued broadcast for channel %s", channelID)
}

// BroadcastAll broadcasts an event to all connected clients
func (h *Hub) BroadcastAll(eventType string, payload interface{}) {
	msg := Message{
		Type:    eventType,
		Payload: MustMarshal(payload),
	}
	log.Printf("[Hub] Queuing global broadcast %s", eventType)
	h.broadcast <- &msg
}

// MustMarshal marshals or returns nil on error
func MustMarshal(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("WebSocket: Error marshaling message: %v", err)
		return nil
	}
	return data
}

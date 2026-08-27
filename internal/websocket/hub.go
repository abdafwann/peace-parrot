package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Client represents a WebSocket client
type Client struct {
	ID       string
	UserID   string
	Username string
	Conn     *websocket.Conn
	Channels map[string]bool // subscribed channels
	mu       sync.RWMutex
}

// Hub manages all WebSocket connections
type Hub struct {
	clients   map[string]*Client
	register  chan *Client
	unregister chan *Client
	broadcast chan *Message
	mu        sync.RWMutex

	// Event handlers
	voiceHandler VoiceHandler
}

// VoiceHandler interface for voice events
type VoiceHandler interface {
	HandleVoiceJoin(userID string, payload []byte) (interface{}, error)
	HandleVoiceLeave(userID string, payload []byte) error
	HandleVoiceStateUpdate(userID string, payload []byte) error
	HandleSpeaking(userID string, payload []byte) error
}

// Message represents a WebSocket message
type Message struct {
	Type      string          `json:"type"`
	ChannelID string          `json:"channelId,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *Message, 256),
	}
}

// SetVoiceHandler sets the voice handler
func (h *Hub) SetVoiceHandler(handler VoiceHandler) {
	h.voiceHandler = handler
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("WebSocket: Client %s connected (user: %s)", client.ID, client.UserID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				client.Conn.Close()
				log.Printf("WebSocket: Client %s disconnected", client.ID)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			log.Printf("[Hub] Received broadcast message type=%s channel=%s", message.Type, message.ChannelID)
			h.mu.RLock()
			for _, client := range h.clients {
				client.mu.RLock()
				if message.ChannelID == "" || client.Channels[message.ChannelID] {
					if err := client.Conn.WriteJSON(message); err != nil {
						log.Printf("WebSocket: Error sending to client %s: %v", client.ID, err)
					}
				}
				client.mu.RUnlock()
			}
			h.mu.RUnlock()
		}
	}
}

// Register registers a new client
func (h *Hub) Register(client *Client) {
	h.register <- client
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
		Payload:   mustMarshal(payload),
	}
	log.Printf("[Hub] Broadcasting %s to channel %s, subscribed clients:", eventType, channelID)
	h.mu.RLock()
	for clientID, client := range h.clients {
		client.mu.RLock()
		subscribed := client.Channels[channelID]
		if subscribed {
			log.Printf("[Hub]   -> client %s (user: %s) SUBSCRIBED", clientID, client.UserID)
		}
		client.mu.RUnlock()
	}
	h.mu.RUnlock()
	h.broadcast <- &msg
}

// SendToUser sends a message to a specific user
func (h *Hub) SendToUser(userID, eventType string, payload interface{}) {
	msg := Message{
		Type:    eventType,
		Payload: mustMarshal(payload),
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		if client.UserID == userID {
			if err := client.Conn.WriteJSON(msg); err != nil {
				log.Printf("WebSocket: Error sending to user %s: %v", userID, err)
			}
		}
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
		Payload:   mustMarshal(payload),
	}
	log.Printf("[Hub] Queuing broadcast %s to channel %s", eventType, channelID)
	h.broadcast <- &msg
	log.Printf("[Hub] Queued broadcast for channel %s", channelID)
}

// mustMarshal marshals or panics
func mustMarshal(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("WebSocket: Error marshaling message: %v", err)
		return nil
	}
	return data
}

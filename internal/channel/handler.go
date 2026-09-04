package channel

import (
	"net/http"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// Handler handles channel endpoints
type Handler struct {
	store *Store
}

// NewHandler creates a new channel handler
func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

// ChannelRequest represents channel create/update request
type ChannelRequest struct {
	Name     string `json:"name"`
	Type     string `json:"type"` // "text" or "voice"
	Topic    string `json:"topic,omitempty"`
	Position int    `json:"position,omitempty"`
}

// ChannelResponse represents channel in API response
type ChannelResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	Topic     string `json:"topic,omitempty"`
	Position  int    `json:"position"`
	CreatedBy string `json:"created_by"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// List handles GET /api/channels
func (h *Handler) List(c echo.Context) error {
	channels, err := h.store.ListChannels()
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list channels", nil)
	}

	response := make([]ChannelResponse, len(channels))
	for i, ch := range channels {
		response[i] = ChannelResponse{
			ID:        ch.ID,
			Name:      ch.Name,
			Type:      ch.Type,
			Topic:     ch.Topic,
			Position:  ch.Position,
			CreatedBy: ch.CreatedBy,
			CreatedAt: ch.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt: ch.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(http.StatusOK, response)
}

// Create handles POST /api/channels
func (h *Handler) Create(c echo.Context) error {
	var req ChannelRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	// Validate
	if req.Name == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Channel name is required", nil)
	}
	if req.Type != "text" && req.Type != "voice" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Type must be 'text' or 'voice'", nil)
	}

	// TODO: Get user ID from JWT middleware
	channel := &Channel{
		Name:     req.Name,
		Type:     req.Type,
		Topic:    req.Topic,
		Position: req.Position,
		CreatedBy: "system", // TODO: Get from JWT
	}

	if err := h.store.CreateChannel(channel); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create channel", nil)
	}

	return c.JSON(http.StatusCreated, ChannelResponse{
		ID:        channel.ID,
		Name:      channel.Name,
		Type:      channel.Type,
		Topic:     channel.Topic,
		Position:  channel.Position,
		CreatedBy: channel.CreatedBy,
		CreatedAt: channel.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: channel.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// Get handles GET /api/channels/:id
func (h *Handler) Get(c echo.Context) error {
	id := c.Param("id")

	channel, err := h.store.GetChannelByID(id)
	if err != nil {
		if err == ErrChannelNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "CHANNEL_NOT_FOUND", "Channel not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get channel", nil)
	}

	return c.JSON(http.StatusOK, ChannelResponse{
		ID:        channel.ID,
		Name:      channel.Name,
		Type:      channel.Type,
		Topic:     channel.Topic,
		Position:  channel.Position,
		CreatedBy: channel.CreatedBy,
		CreatedAt: channel.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: channel.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// Update handles PATCH /api/channels/:id
func (h *Handler) Update(c echo.Context) error {
	id := c.Param("id")

	var req ChannelRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	channel, err := h.store.GetChannelByID(id)
	if err != nil {
		if err == ErrChannelNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "CHANNEL_NOT_FOUND", "Channel not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get channel", nil)
	}

	// Update fields
	if req.Name != "" {
		channel.Name = req.Name
	}
	if req.Type != "" {
		if req.Type != "text" && req.Type != "voice" {
			return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Type must be 'text' or 'voice'", nil)
		}
		channel.Type = req.Type
	}
	channel.Topic = req.Topic
	channel.Position = req.Position

	if err := h.store.UpdateChannel(channel); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update channel", nil)
	}

	return c.JSON(http.StatusOK, ChannelResponse{
		ID:        channel.ID,
		Name:      channel.Name,
		Type:      channel.Type,
		Topic:     channel.Topic,
		Position:  channel.Position,
		CreatedBy: channel.CreatedBy,
		CreatedAt: channel.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: channel.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// Delete handles DELETE /api/channels/:id
func (h *Handler) Delete(c echo.Context) error {
	id := c.Param("id")

	if err := h.store.DeleteChannel(id); err != nil {
		if err == ErrChannelNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "CHANNEL_NOT_FOUND", "Channel not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete channel", nil)
	}

	return c.NoContent(http.StatusNoContent)
}

// Reorder handles PATCH or POST /api/channels/reorder
func (h *Handler) Reorder(c echo.Context) error {
	var items []ChannelPositionItem
	if err := c.Bind(&items); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	if len(items) == 0 {
		return c.NoContent(http.StatusOK)
	}

	if err := h.store.ReorderChannels(items); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to reorder channels", nil)
	}

	return c.NoContent(http.StatusOK)
}


package message

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// Handler handles message endpoints
type Handler struct {
	store *Store
}

// NewHandler creates a new message handler
func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

// MessageRequest represents message create/edit request
type MessageRequest struct {
	Content string `json:"content"`
}

// MessageResponse represents message in API response
type MessageResponse struct {
	ID         string  `json:"id"`
	ChannelID  string  `json:"channel_id"`
	AuthorID   string  `json:"author_id"`
	AuthorName string  `json:"author_name,omitempty"`
	Content    string  `json:"content"`
	CreatedAt  string  `json:"created_at"`
	EditedAt   *string `json:"edited_at,omitempty"`
	DeletedAt  *string `json:"deleted_at,omitempty"`
}

// List handles GET /api/channels/:id/messages
func (h *Handler) List(c echo.Context) error {
	channelID := c.Param("id")
	beforeID := c.QueryParam("before")
	limit := DefaultPageSize

	// Parse limit if provided
	if l := c.QueryParam("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	messages, err := h.store.ListMessagesByChannel(channelID, beforeID, limit)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list messages", nil)
	}

	response := make([]MessageResponse, len(messages))
	for i, msg := range messages {
		response[i] = MessageResponse{
			ID:         msg.ID,
			ChannelID:  msg.ChannelID,
			AuthorID:   msg.AuthorID,
			AuthorName: msg.AuthorName,
			Content:    msg.Content,
			CreatedAt:  msg.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
		if msg.EditedAt != nil {
			edited := msg.EditedAt.Format("2006-01-02T15:04:05Z")
			response[i].EditedAt = &edited
		}
		if msg.DeletedAt != nil {
			deleted := msg.DeletedAt.Format("2006-01-02T15:04:05Z")
			response[i].DeletedAt = &deleted
		}
	}

	return c.JSON(http.StatusOK, response)
}

// Create handles POST /api/channels/:id/messages
func (h *Handler) Create(c echo.Context) error {
	channelID := c.Param("id")

	var req MessageRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	// Validate
	req.Content = trimAndValidate(req.Content)
	if req.Content == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Message content is required", nil)
	}
	if len(req.Content) > MaxMessageLength {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Message exceeds maximum length of 4000 characters", nil)
	}

	// TODO: Get author ID from JWT middleware
	msg := &Message{
		ChannelID: channelID,
		AuthorID:  "system", // TODO: Get from JWT
		Content:   req.Content,
	}

	if err := h.store.CreateMessage(msg); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create message", nil)
	}

	return c.JSON(http.StatusCreated, MessageResponse{
		ID:        msg.ID,
		ChannelID: msg.ChannelID,
		AuthorID:  msg.AuthorID,
		Content:   msg.Content,
		CreatedAt: msg.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// Update handles PATCH /api/messages/:id
func (h *Handler) Update(c echo.Context) error {
	id := c.Param("id")

	var req MessageRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	// Validate
	req.Content = trimAndValidate(req.Content)
	if req.Content == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Message content is required", nil)
	}
	if len(req.Content) > MaxMessageLength {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Message exceeds maximum length of 4000 characters", nil)
	}

	// TODO: Check ownership (author_id matches JWT user)
	// TODO: Prevent editing deleted messages

	if err := h.store.UpdateMessage(id, req.Content); err != nil {
		if err == ErrMessageNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "MESSAGE_NOT_FOUND", "Message not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update message", nil)
	}

	// Get updated message
	msg, err := h.store.GetMessageByID(id)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get message", nil)
	}

	edited := msg.EditedAt.Format("2006-01-02T15:04:05Z")
	return c.JSON(http.StatusOK, MessageResponse{
		ID:        msg.ID,
		ChannelID: msg.ChannelID,
		AuthorID:  msg.AuthorID,
		Content:   msg.Content,
		CreatedAt: msg.CreatedAt.Format("2006-01-02T15:04:05Z"),
		EditedAt:  &edited,
	})
}

// Delete handles DELETE /api/messages/:id
func (h *Handler) Delete(c echo.Context) error {
	id := c.Param("id")

	// TODO: Check ownership or moderator status

	if err := h.store.DeleteMessage(id); err != nil {
		if err == ErrMessageNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "MESSAGE_NOT_FOUND", "Message not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete message", nil)
	}

	return c.NoContent(http.StatusNoContent)
}

// Search handles GET /api/messages/search
func (h *Handler) Search(c echo.Context) error {
	query := c.QueryParam("q")
	if query == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Search query is required", nil)
	}

	messages, err := h.store.SearchMessages(query, DefaultPageSize)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to search messages", nil)
	}

	response := make([]MessageResponse, len(messages))
	for i, msg := range messages {
		response[i] = MessageResponse{
			ID:        msg.ID,
			ChannelID: msg.ChannelID,
			AuthorID:  msg.AuthorID,
			Content:   msg.Content,
			CreatedAt: msg.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(http.StatusOK, response)
}

// trimAndValidate trims whitespace and validates content
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

// CreateMessage creates a message (used by WebSocket handler)
func (h *Handler) CreateMessage(channelID, authorID, content string) (*Message, error) {
	// Validate
	content = trimAndValidate(content)
	if content == "" {
		return nil, fmt.Errorf("message content is required")
	}
	if len(content) > MaxMessageLength {
		return nil, fmt.Errorf("message exceeds maximum length of %d characters", MaxMessageLength)
	}

	msg := &Message{
		ChannelID: channelID,
		AuthorID:  authorID,
		Content:   content,
	}

	if err := h.store.CreateMessage(msg); err != nil {
		return nil, err
	}

	return msg, nil
}

// EditMessage edits a message (used by WebSocket handler)
// Returns nil, nil if message not found or not authorized (for silent ignore)
func (h *Handler) EditMessage(messageID, authorID, content string) (*Message, error) {
	content = trimAndValidate(content)
	if content == "" {
		return nil, fmt.Errorf("message content is required")
	}
	if len(content) > MaxMessageLength {
		return nil, fmt.Errorf("message exceeds maximum length of %d characters", MaxMessageLength)
	}

	// Check ownership
	existing, err := h.store.GetMessageByID(messageID)
	if err != nil {
		if err == ErrMessageNotFound {
			return nil, nil
		}
		return nil, err
	}
	if existing.AuthorID != authorID {
		return nil, ErrNotAuthorized
	}

	if err := h.store.UpdateMessage(messageID, content); err != nil {
		return nil, err
	}

	return h.store.GetMessageByID(messageID)
}

// DeleteMessage deletes a message (used by WebSocket handler)
// Returns nil, nil if message not found or not authorized (for silent ignore)
func (h *Handler) DeleteMessage(messageID, authorID string) (*Message, error) {
	// Check ownership
	existing, err := h.store.GetMessageByID(messageID)
	if err != nil {
		if err == ErrMessageNotFound {
			return nil, nil
		}
		return nil, nil
	}
	if existing.AuthorID != authorID {
		return nil, ErrNotAuthorized
	}

	if err := h.store.DeleteMessage(messageID); err != nil {
		return nil, err
	}

	return existing, nil
}

package message

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

type userStore interface {
	GetUserByID(id string) (*user.User, error)
}

// Handler handles message endpoints
type Handler struct {
	store     *Store
	userStore userStore
}

// NewHandler creates a new message handler
func NewHandler(store *Store, userStore userStore) *Handler {
	return &Handler{store: store, userStore: userStore}
}

// MessageRequest represents message create/edit request
type MessageRequest struct {
	Content     string       `json:"content"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

// MessageResponse represents message in API response
type MessageResponse struct {
	ID              string       `json:"id"`
	ChannelID       string       `json:"channel_id"`
	AuthorID        string       `json:"author_id"`
	AuthorName      string       `json:"author_name,omitempty"`
	AuthorAvatarURL string       `json:"author_avatar_url,omitempty"`
	Content         string       `json:"content"`
	Attachments     []Attachment `json:"attachments"`
	CreatedAt       string       `json:"created_at"`
	EditedAt        *string      `json:"edited_at,omitempty"`
	DeletedAt       *string      `json:"deleted_at,omitempty"`
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
		attachments := msg.Attachments
		if attachments == nil {
			attachments = []Attachment{}
		}
		response[i] = MessageResponse{
			ID:              msg.ID,
			ChannelID:       msg.ChannelID,
			AuthorID:        msg.AuthorID,
			AuthorName:      msg.AuthorName,
			AuthorAvatarURL: msg.AuthorAvatarURL,
			Content:         msg.Content,
			Attachments:     attachments,
			CreatedAt:       msg.CreatedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		}
		if msg.EditedAt != nil {
			edited := msg.EditedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00")
			response[i].EditedAt = &edited
		}
		if msg.DeletedAt != nil {
			deleted := msg.DeletedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00")
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
	if req.Content == "" && len(req.Attachments) == 0 {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Message content or attachment is required", nil)
	}
	if len(req.Content) > MaxMessageLength {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Message exceeds maximum length of 4000 characters", nil)
	}

	attachments := req.Attachments
	if attachments == nil {
		attachments = []Attachment{}
	}

	// Extract author ID from JWT middleware if present
	var authorID string
	if id, ok := c.Get("userId").(string); ok && id != "" {
		authorID = id
	} else if id, ok := c.Get("user_id").(string); ok && id != "" {
		authorID = id
	} else if id, ok := c.Get("userID").(string); ok && id != "" {
		authorID = id
	}
	if authorID == "" {
		authorID = "system"
	}

	msg := &Message{
		ChannelID:   channelID,
		AuthorID:    authorID,
		Content:     req.Content,
		Attachments: attachments,
	}

	if err := h.store.CreateMessage(msg); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create message", nil)
	}

	// Fetch created message with joined author details
	if created, err := h.store.GetMessageByID(msg.ID); err == nil && created != nil {
		msg = created
	}

	return c.JSON(http.StatusCreated, MessageResponse{
		ID:              msg.ID,
		ChannelID:       msg.ChannelID,
		AuthorID:        msg.AuthorID,
		AuthorName:      msg.AuthorName,
		AuthorAvatarURL: msg.AuthorAvatarURL,
		Content:         msg.Content,
		Attachments:     attachments,
		CreatedAt:       msg.CreatedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
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

	// Check ownership or admin status
	existingMsg, err := h.store.GetMessageByID(id)
	if err != nil {
		if err == ErrMessageNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "MESSAGE_NOT_FOUND", "Message not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve message", nil)
	}

	if existingMsg.DeletedAt != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Cannot edit a deleted message", nil)
	}

	currentUserID := auth.GetUserID(c)
	isAdmin := false
	if h.userStore != nil && currentUserID != "" {
		if u, err := h.userStore.GetUserByID(currentUserID); err == nil && u != nil {
			isAdmin = strings.EqualFold(u.Role, "Admin")
		}
	}
	if existingMsg.AuthorID != currentUserID && !isAdmin {
		return middleware.WriteError(c, http.StatusForbidden, "FORBIDDEN", "You do not have permission to edit this message", nil)
	}

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

	// Check ownership or admin status
	existingMsg, err := h.store.GetMessageByID(id)
	if err != nil {
		if err == ErrMessageNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "MESSAGE_NOT_FOUND", "Message not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve message", nil)
	}

	currentUserID := auth.GetUserID(c)
	isAdmin := false
	if h.userStore != nil && currentUserID != "" {
		if u, err := h.userStore.GetUserByID(currentUserID); err == nil && u != nil {
			isAdmin = strings.EqualFold(u.Role, "Admin")
		}
	}
	if existingMsg.AuthorID != currentUserID && !isAdmin {
		return middleware.WriteError(c, http.StatusForbidden, "FORBIDDEN", "You do not have permission to delete this message", nil)
	}

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
	return h.CreateMessageWithAttachments(channelID, authorID, content, nil)
}

// CreateMessageWithAttachments creates a message with attachments for WebSocket/service handlers
func (h *Handler) CreateMessageWithAttachments(channelID, authorID, content string, attachments []Attachment) (*Message, error) {
	// Validate
	content = trimAndValidate(content)
	if content == "" && len(attachments) == 0 {
		return nil, fmt.Errorf("message content or attachment is required")
	}
	if len(content) > MaxMessageLength {
		return nil, fmt.Errorf("message exceeds maximum length of %d characters", MaxMessageLength)
	}

	if attachments == nil {
		attachments = []Attachment{}
	}

	msg := &Message{
		ChannelID:   channelID,
		AuthorID:    authorID,
		Content:     content,
		Attachments: attachments,
	}

	if err := h.store.CreateMessage(msg); err != nil {
		return nil, err
	}

	// Fetch created message with joined user data (display name and avatar URL)
	if created, err := h.store.GetMessageByID(msg.ID); err == nil && created != nil {
		return created, nil
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

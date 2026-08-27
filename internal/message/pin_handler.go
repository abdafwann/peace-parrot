package message

import (
	"net/http"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// PinHandler handles pin endpoints
type PinHandler struct {
	store       *Store
	msgStore    *Store
}

// NewPinHandler creates a new pin handler
func NewPinHandler(store *Store) *PinHandler {
	return &PinHandler{store: store}
}

// Pin handles POST /api/channels/:id/pins/:messageId
func (h *PinHandler) Pin(c echo.Context) error {
	channelID := c.Param("id")
	messageID := c.Param("messageId")

	// Verify message exists and belongs to channel
	msg, err := h.store.GetMessageByID(messageID)
	if err != nil {
		if err == ErrMessageNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "MESSAGE_NOT_FOUND", "Message not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get message", nil)
	}

	if msg.ChannelID != channelID {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Message does not belong to this channel", nil)
	}

	// TODO: Get user ID from JWT middleware
	pinnedBy := "system" // TODO: Get from JWT

	if err := h.store.PinMessage(messageID, pinnedBy); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to pin message", nil)
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Message pinned"})
}

// Unpin handles DELETE /api/channels/:id/pins/:messageId
func (h *PinHandler) Unpin(c echo.Context) error {
	messageID := c.Param("messageId")

	if err := h.store.UnpinMessage(messageID); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to unpin message", nil)
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Message unpinned"})
}

// ListPins handles GET /api/channels/:id/pins
func (h *PinHandler) ListPins(c echo.Context) error {
	channelID := c.Param("id")

	messages, err := h.store.GetPinnedMessages(channelID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list pinned messages", nil)
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
		if msg.EditedAt != nil {
			edited := msg.EditedAt.Format("2006-01-02T15:04:05Z")
			response[i].EditedAt = &edited
		}
	}

	return c.JSON(http.StatusOK, response)
}

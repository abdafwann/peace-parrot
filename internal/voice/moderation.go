package voice

import (
	"net/http"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// ModerationHandler handles voice moderation endpoints
type ModerationHandler struct {
	handler *Handler
}

// NewModerationHandler creates a new moderation handler
func NewModerationHandler(handler *Handler) *ModerationHandler {
	return &ModerationHandler{handler: handler}
}

// MuteUser handles POST /api/voice/mute/:userId
func (h *ModerationHandler) MuteUser(c echo.Context) error {
	userID := c.Param("userId")

	// TODO: Get channelID from request body or query
	// For now, we need to find which channel the user is in
	channels := h.handler.GetUserChannels(userID)
	if len(channels) == 0 {
		return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_IN_VOICE", "User is not in a voice channel", nil)
	}

	// Mute in the first channel they're in
	// In a real app, you'd specify which channel
	channelID := channels[0]

	if err := h.handler.MuteUser(channelID, userID); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to mute user", nil)
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "User muted",
	})
}

// UnmuteUser handles DELETE /api/voice/mute/:userId
func (h *ModerationHandler) UnmuteUser(c echo.Context) error {
	userID := c.Param("userId")

	channels := h.handler.GetUserChannels(userID)
	if len(channels) == 0 {
		return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_IN_VOICE", "User is not in a voice channel", nil)
	}

	channelID := channels[0]

	if err := h.handler.UnmuteUser(channelID, userID); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to unmute user", nil)
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "User unmuted",
	})
}

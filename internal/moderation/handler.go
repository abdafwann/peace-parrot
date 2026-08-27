package moderation

import (
	"fmt"
	"net/http"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// Handler handles moderation endpoints
type Handler struct {
	store *Store
}

// NewHandler creates a new moderation handler
func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

// MuteRequest represents mute request body
type MuteRequest struct {
	DurationMinutes int `json:"duration_minutes"` // 0 = permanent
}

// MuteResponse represents mute response
type MuteResponse struct {
	Message string `json:"message"`
}

// Kick handles POST /api/moderation/kick/:userId
func (h *Handler) Kick(c echo.Context) error {
	userID := c.Param("userId")

	if err := h.store.KickUser(userID, "admin"); err != nil {
		if err == ErrUserNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to kick user", nil)
	}

	return c.JSON(http.StatusOK, MuteResponse{Message: "User kicked"})
}

// Ban handles POST /api/moderation/ban/:userId
func (h *Handler) Ban(c echo.Context) error {
	userID := c.Param("userId")

	if err := h.store.BanUser(userID, "admin"); err != nil {
		if err == ErrUserNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to ban user", nil)
	}

	return c.JSON(http.StatusOK, MuteResponse{Message: "User banned"})
}

// Unban handles DELETE /api/moderation/ban/:userId
func (h *Handler) Unban(c echo.Context) error {
	userID := c.Param("userId")

	if err := h.store.UnbanUser(userID); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to unban user", nil)
	}

	return c.JSON(http.StatusOK, MuteResponse{Message: "User unbanned"})
}

// Mute handles POST /api/moderation/mute/:userId
func (h *Handler) Mute(c echo.Context) error {
	userID := c.Param("userId")

	var req MuteRequest
	if err := c.Bind(&req); err != nil {
		req.DurationMinutes = 0 // Default to permanent
	}

	if err := h.store.MuteUser(userID, "admin", req.DurationMinutes); err != nil {
		if err == ErrUserNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to mute user", nil)
	}

	msg := "User muted"
	if req.DurationMinutes > 0 {
		msg = fmt.Sprintf("User muted for %d minutes", req.DurationMinutes)
	}

	return c.JSON(http.StatusOK, MuteResponse{Message: msg})
}

// Unmute handles DELETE /api/moderation/mute/:userId
func (h *Handler) Unmute(c echo.Context) error {
	userID := c.Param("userId")

	if err := h.store.UnmuteUser(userID); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to unmute user", nil)
	}

	return c.JSON(http.StatusOK, MuteResponse{Message: "User unmuted"})
}

// CheckStatus handles GET /api/moderation/status/:userId
func (h *Handler) CheckStatus(c echo.Context) error {
	userID := c.Param("userId")

	muted, err := h.store.IsUserMuted(userID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to check status", nil)
	}

	banned, err := h.store.IsUserBanned(userID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to check status", nil)
	}

	return c.JSON(http.StatusOK, map[string]bool{
		"muted":  muted,
		"banned": banned,
	})
}

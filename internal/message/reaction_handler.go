package message

import (
	"net/http"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// ReactionHandler handles reaction endpoints
type ReactionHandler struct {
	store *Store
}

// NewReactionHandler creates a new reaction handler
func NewReactionHandler(store *Store) *ReactionHandler {
	return &ReactionHandler{store: store}
}

// ReactionRequest represents reaction request
type ReactionRequest struct {
	Emoji string `json:"emoji"`
}

// ReactionResponse represents reaction in API response
type ReactionResponse struct {
	Emoji string     `json:"emoji"`
	Count int        `json:"count"`
	Users []UserInfo `json:"users"`
}

// AddReaction handles POST /api/messages/:id/reactions
func (h *ReactionHandler) AddReaction(c echo.Context) error {
	messageID := c.Param("id")

	var req ReactionRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	// Validate emoji
	req.Emoji = trimAndValidate(req.Emoji)
	if req.Emoji == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Emoji is required", nil)
	}

	// TODO: Get user ID from JWT middleware
	userID := "system" // TODO: Get from JWT

	if err := h.store.AddReaction(messageID, userID, req.Emoji); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to add reaction", nil)
	}

	// Get updated reactions
	reactions, err := h.store.GetReactionsWithUsers(messageID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get reactions", nil)
	}

	response := make([]ReactionResponse, len(reactions))
	for i, r := range reactions {
		response[i] = ReactionResponse{
			Emoji: r.Emoji,
			Count: r.Count,
			Users: r.Users,
		}
	}

	return c.JSON(http.StatusOK, response)
}

// RemoveReaction handles DELETE /api/messages/:id/reactions/:emoji
func (h *ReactionHandler) RemoveReaction(c echo.Context) error {
	messageID := c.Param("id")
	emoji := c.Param("emoji")

	// TODO: Get user ID from JWT middleware
	userID := "system" // TODO: Get from JWT

	if err := h.store.RemoveReaction(messageID, userID, emoji); err != nil {
		if err == ErrReactionNotFound {
			return middleware.WriteError(c, http.StatusNotFound, "REACTION_NOT_FOUND", "Reaction not found", nil)
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to remove reaction", nil)
	}

	// Get updated reactions
	reactions, err := h.store.GetReactionsWithUsers(messageID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get reactions", nil)
	}

	response := make([]ReactionResponse, len(reactions))
	for i, r := range reactions {
		response[i] = ReactionResponse{
			Emoji: r.Emoji,
			Count: r.Count,
			Users: r.Users,
		}
	}

	return c.JSON(http.StatusOK, response)
}

// GetReactions handles GET /api/messages/:id/reactions
func (h *ReactionHandler) GetReactions(c echo.Context) error {
	messageID := c.Param("id")

	reactions, err := h.store.GetReactionsWithUsers(messageID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get reactions", nil)
	}

	response := make([]ReactionResponse, len(reactions))
	for i, r := range reactions {
		response[i] = ReactionResponse{
			Emoji: r.Emoji,
			Count: r.Count,
			Users: r.Users,
		}
	}

	return c.JSON(http.StatusOK, response)
}

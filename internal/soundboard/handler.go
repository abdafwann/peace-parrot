package soundboard

import (
	"net/http"
	"strings"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/internal/websocket"
	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

type userStore interface {
	GetUserByID(id string) (*user.User, error)
}

type Handler struct {
	store     *Store
	hub       *websocket.Hub
	userStore userStore
}

func NewHandler(store *Store, hub *websocket.Hub, userStore userStore) *Handler {
	return &Handler{
		store:     store,
		hub:       hub,
		userStore: userStore,
	}
}

// List handles GET /api/soundboard
func (h *Handler) List(c echo.Context) error {
	items, err := h.store.List()
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list soundboard items", nil)
	}
	return c.JSON(http.StatusOK, items)
}

// Create handles POST /api/soundboard
func (h *Handler) Create(c echo.Context) error {
	var userID *string
	if id, ok := c.Get("userId").(string); ok && id != "" {
		userID = &id
	} else if id, ok := c.Get("user_id").(string); ok && id != "" {
		userID = &id
	} else if id, ok := c.Get("userID").(string); ok && id != "" {
		userID = &id
	}

	var req CreateSoundboardItemRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
	}

	if strings.TrimSpace(req.Name) == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Name is required", nil)
	}
	if strings.TrimSpace(req.CustomURL) == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Custom URL is required", nil)
	}

	item, err := h.store.Create(&req, userID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create soundboard item", nil)
	}

	// Broadcast real-time soundboard item add to all users
	if h.hub != nil {
		h.hub.BroadcastAll("soundboard_item_add", item)
	}

	return c.JSON(http.StatusCreated, item)
}

// Delete handles DELETE /api/soundboard/:id
func (h *Handler) Delete(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "INVALID_REQUEST", "ID is required", nil)
	}

	item, err := h.store.GetByID(id)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve soundboard item", nil)
	}
	if item == nil {
		return middleware.WriteError(c, http.StatusNotFound, "NOT_FOUND", "Soundboard item not found", nil)
	}

	currentUserID := auth.GetUserID(c)
	isAdmin := false
	if h.userStore != nil && currentUserID != "" {
		if u, err := h.userStore.GetUserByID(currentUserID); err == nil && u != nil {
			isAdmin = strings.EqualFold(u.Role, "Admin")
		}
	}

	isCreator := item.CreatedBy != nil && *item.CreatedBy == currentUserID
	if !isCreator && !isAdmin {
		return middleware.WriteError(c, http.StatusForbidden, "FORBIDDEN", "You do not have permission to delete this soundboard item", nil)
	}

	err = h.store.Delete(id)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete soundboard item", nil)
	}

	if h.hub != nil {
		h.hub.BroadcastAll("soundboard_item_delete", map[string]string{
			"id": id,
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Soundboard item deleted successfully",
		"id":      id,
	})
}

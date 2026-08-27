package user

import (
	"net/http"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// UserResponse represents public user information
type UserResponse struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName,omitempty"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
	Bio         string `json:"bio,omitempty"`
	Role        string `json:"role,omitempty"`
}

// Handler handles user HTTP requests
type Handler struct {
	store *Store
}

// NewHandler creates a new user handler
func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

// List handles GET /api/users
func (h *Handler) List(c echo.Context) error {
	users, err := h.store.ListUsers()
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list users", nil)
	}

	response := make([]UserResponse, len(users))
	for i, u := range users {
		role := "Member"
		if i == 0 {
			role = "Admin"
		} else if i == 1 {
			role = "Moderator"
		}

		response[i] = UserResponse{
			ID:          u.ID,
			Username:    u.Username,
			DisplayName: u.DisplayName,
			AvatarURL:   u.AvatarURL,
			Bio:         u.Bio,
			Role:        role,
		}
	}

	return c.JSON(http.StatusOK, response)
}

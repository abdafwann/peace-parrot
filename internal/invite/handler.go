package invite

import (
	"errors"
	"net/http"
	"strings"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

type CreateInviteRequest struct {
	DurationHours int `json:"durationHours"` // 0 = never expires, 24 = 1 day, etc.
}

// Create handles POST /api/invites
func (h *Handler) Create(c echo.Context) error {
	var userID string
	if id, ok := c.Get("userId").(string); ok && id != "" {
		userID = id
	} else if id, ok := c.Get("user_id").(string); ok && id != "" {
		userID = id
	} else if id, ok := c.Get("userID").(string); ok && id != "" {
		userID = id
	}

	if userID == "" {
		return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", nil)
	}

	var req CreateInviteRequest
	_ = c.Bind(&req)

	inv, err := h.store.CreateInvite(userID, req.DurationHours)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate invite code", nil)
	}

	return c.JSON(http.StatusCreated, inv)
}

// List handles GET /api/invites
func (h *Handler) List(c echo.Context) error {
	invites, err := h.store.ListInvites()
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list invites", nil)
	}
	if invites == nil {
		invites = []*Invite{}
	}
	return c.JSON(http.StatusOK, invites)
}

// Validate handles GET /api/invites/validate/:code
func (h *Handler) Validate(c echo.Context) error {
	code := strings.TrimSpace(c.Param("code"))
	if code == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invite code parameter is required", nil)
	}

	inv, err := h.store.ValidateCode(code)
	if err != nil {
		if errors.Is(err, ErrInviteNotFound) {
			return middleware.WriteError(c, http.StatusNotFound, "INVITE_NOT_FOUND", "Invite code not found", nil)
		}
		if errors.Is(err, ErrInviteUsed) {
			return middleware.WriteError(c, http.StatusBadRequest, "INVITE_USED", "This invite code has already been used", nil)
		}
		if errors.Is(err, ErrInviteExpired) {
			return middleware.WriteError(c, http.StatusBadRequest, "INVITE_EXPIRED", "This invite code has expired", nil)
		}
		return middleware.WriteError(c, http.StatusBadRequest, "INVALID_INVITE", err.Error(), nil)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid":     true,
		"code":      inv.Code,
		"createdBy": inv.CreatedBy,
	})
}

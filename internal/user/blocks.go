package user

import (
	"errors"
	"net/http"

	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

func (s *Store) ListBlocks(ownerID string) ([]string, error) {
	rows, err := s.db.Query("SELECT target_id FROM user_blocks WHERE owner_id = ? ORDER BY target_id", ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Store) BlockUser(ownerID, targetID string) error {
	_, err := s.db.Exec("INSERT INTO user_blocks (owner_id, target_id) VALUES (?, ?) ON CONFLICT(owner_id, target_id) DO NOTHING", ownerID, targetID)
	return err
}

func (s *Store) UnblockUser(ownerID, targetID string) error {
	_, err := s.db.Exec("DELETE FROM user_blocks WHERE owner_id = ? AND target_id = ?", ownerID, targetID)
	return err
}

func (h *Handler) SetBlocksUpdateNotifier(notify func(string)) { h.notifyBlocksUpdate = notify }

func (h *Handler) RegisterBlockRoutes(api *echo.Group, auth echo.MiddlewareFunc) {
	api.GET("/users/me/blocks", h.listBlocks, auth)
	api.PUT("/users/me/blocks/:userId", h.blockUser, auth)
	api.DELETE("/users/me/blocks/:userId", h.unblockUser, auth)
}

func (h *Handler) listBlocks(c echo.Context) error {
	owner, _ := c.Get("userId").(string)
	if owner == "" {
		return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", nil)
	}
	ids, err := h.store.ListBlocks(owner)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load blocks", nil)
	}
	return c.JSON(http.StatusOK, ids)
}

func (h *Handler) changeBlock(c echo.Context, block bool) error {
	owner, _ := c.Get("userId").(string)
	if owner == "" {
		return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", nil)
	}
	target := c.Param("userId")
	if owner == target {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Cannot block yourself", nil)
	}
	if block {
		if _, err := h.store.GetUserByID(target); err != nil {
			if errors.Is(err, ErrUserNotFound) {
				return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found", nil)
			}
			return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read user", nil)
		}
		if err := h.store.BlockUser(owner, target); err != nil {
			return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to block user", nil)
		}
	} else if err := h.store.UnblockUser(owner, target); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to unblock user", nil)
	}
	if h.notifyBlocksUpdate != nil {
		h.notifyBlocksUpdate(owner)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) blockUser(c echo.Context) error   { return h.changeBlock(c, true) }
func (h *Handler) unblockUser(c echo.Context) error { return h.changeBlock(c, false) }

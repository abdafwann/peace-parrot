package server

import (
	"context"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/internal/moderation"
	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/internal/websocket"
	"github.com/abdafwann/peace-parrot/pkg/cloudinary"
	"github.com/labstack/echo/v4"
)

// Handler handles server settings and admin moderation requests
type Handler struct {
	serverStore *Store
	userStore   *user.Store
	modStore    *moderation.Store
	cld         *cloudinary.Client
	hub         *websocket.Hub
}

// NewHandler creates a new server handler
func NewHandler(
	serverStore *Store,
	userStore *user.Store,
	modStore *moderation.Store,
	cld *cloudinary.Client,
	hub *websocket.Hub,
) *Handler {
	return &Handler{
		serverStore: serverStore,
		userStore:   userStore,
		modStore:    modStore,
		cld:         cld,
		hub:         hub,
	}
}

// UpdateServerSettingsRequest represents body for server settings update
type UpdateServerSettingsRequest struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	SlowModeSeconds int    `json:"slowModeSeconds"`
}

// UpdateMemberRoleRequest represents role update payload
type UpdateMemberRoleRequest struct {
	Role string `json:"role"` // "Admin", "Moderator", "Member"
}

// MuteMemberRequest represents mute payload
type MuteMemberRequest struct {
	DurationMinutes int `json:"durationMinutes"`
}

// GetServerSettings returns global server settings
func (h *Handler) GetServerSettings(c echo.Context) error {
	settings, err := h.serverStore.GetServerSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get server settings"})
	}
	return c.JSON(http.StatusOK, settings)
}

// UpdateServerSettings updates server details
func (h *Handler) UpdateServerSettings(c echo.Context) error {
	var req UpdateServerSettingsRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "server name is required"})
	}

	if err := h.serverStore.UpdateServerSettings(req.Name, req.Description, req.SlowModeSeconds); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update server settings"})
	}

	settings, _ := h.serverStore.GetServerSettings()

	// Broadcast server update event to all connected clients
	if h.hub != nil {
		h.hub.BroadcastAll("server_settings_updated", settings)
	}

	return c.JSON(http.StatusOK, settings)
}

// UploadServerIcon handles uploading a new server icon
func (h *Handler) UploadServerIcon(c echo.Context) error {
	fileHeader, err := c.FormFile("icon")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing icon file in form data"})
	}

	if fileHeader.Size > 10*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file too large (max 10MB)"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open uploaded file"})
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "unsupported file format. Use JPG, PNG, WEBP, or GIF"})
	}

	data, err := io.ReadAll(file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file"})
	}

	if h.cld == nil || !h.cld.IsConfigured() {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Cloudinary is not configured on the server"})
	}

	uploadResult, err := h.cld.UploadMedia(c.Request().Context(), data, fileHeader.Filename, "peace-parrot/server")
	if err != nil {
		log.Printf("[ServerIcon] Upload error: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload image to cloud storage"})
	}

	oldPublicID, err := h.serverStore.UpdateServerIcon(uploadResult.SecureURL, uploadResult.PublicID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update server icon"})
	}

	if oldPublicID != "" && oldPublicID != uploadResult.PublicID {
		go func() {
			if err := h.cld.DeleteMedia(context.Background(), oldPublicID); err != nil {
				log.Printf("[ServerIcon] Failed to delete previous icon %s: %v", oldPublicID, err)
			}
		}()
	}

	settings, _ := h.serverStore.GetServerSettings()
	if h.hub != nil {
		h.hub.BroadcastAll("server_settings_updated", settings)
	}

	return c.JSON(http.StatusOK, settings)
}

// ListBans returns all bans
func (h *Handler) ListBans(c echo.Context) error {
	bans, err := h.serverStore.ListBans()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list bans"})
	}
	return c.JSON(http.StatusOK, bans)
}

// BanUser bans a user
func (h *Handler) BanUser(c echo.Context) error {
	targetUserID := c.Param("userId")
	claims := auth.GetClaims(c)
	bannedBy := "admin"
	if claims != nil {
		bannedBy = claims.Username
	}

	if err := h.modStore.BanUser(targetUserID, bannedBy); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to ban user"})
	}

	// Disconnect user's active WebSockets if connected
	if h.hub != nil {
		h.hub.SendToUser(targetUserID, "force_disconnect", map[string]string{"reason": "You have been banned from this server."})
		h.hub.BroadcastAll("user_banned", map[string]string{"userId": targetUserID})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user banned successfully"})
}

// UnbanUser unbans a user
func (h *Handler) UnbanUser(c echo.Context) error {
	targetUserID := c.Param("userId")
	if err := h.modStore.UnbanUser(targetUserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to unban user"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "user unbanned successfully"})
}

// KickUser kicks a user
func (h *Handler) KickUser(c echo.Context) error {
	targetUserID := c.Param("userId")
	claims := auth.GetClaims(c)
	kickedBy := "admin"
	if claims != nil {
		kickedBy = claims.Username
	}

	if err := h.modStore.KickUser(targetUserID, kickedBy); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to kick user"})
	}

	if h.hub != nil {
		h.hub.SendToUser(targetUserID, "force_disconnect", map[string]string{"reason": "You have been kicked from the server."})
		h.hub.BroadcastAll("user_kicked", map[string]string{"userId": targetUserID})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user kicked successfully"})
}

// MuteUser mutes a user
func (h *Handler) MuteUser(c echo.Context) error {
	targetUserID := c.Param("userId")
	var req MuteMemberRequest
	_ = c.Bind(&req)

	claims := auth.GetClaims(c)
	mutedBy := "admin"
	if claims != nil {
		mutedBy = claims.Username
	}

	if err := h.modStore.MuteUser(targetUserID, mutedBy, req.DurationMinutes); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to mute user"})
	}

	if h.hub != nil {
		h.hub.BroadcastAll("user_muted", map[string]interface{}{
			"userId": targetUserID,
			"muted":  true,
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user muted successfully"})
}

// UnmuteUser unmutes a user
func (h *Handler) UnmuteUser(c echo.Context) error {
	targetUserID := c.Param("userId")
	if err := h.modStore.UnmuteUser(targetUserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to unmute user"})
	}

	if h.hub != nil {
		h.hub.BroadcastAll("user_muted", map[string]interface{}{
			"userId": targetUserID,
			"muted":  false,
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user unmuted successfully"})
}

// UpdateMemberRole updates role of a user
func (h *Handler) UpdateMemberRole(c echo.Context) error {
	targetUserID := c.Param("userId")
	var req UpdateMemberRoleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	req.Role = strings.TrimSpace(req.Role)
	if req.Role == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "role name cannot be empty"})
	}

	if err := h.userStore.UpdateUserRole(targetUserID, req.Role); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update user role"})
	}

	if h.hub != nil {
		h.hub.BroadcastAll("user_role_updated", map[string]interface{}{
			"userId": targetUserID,
			"role":   req.Role,
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "user role updated successfully", "role": req.Role})
}

// CreateRoleRequest payload
type CreateRoleRequest struct {
	Name        string `json:"name"`
	Color       string `json:"color"`
	IconURL     string `json:"iconUrl"`
	Permissions int    `json:"permissions"`
}

// ListRoles returns all server roles
func (h *Handler) ListRoles(c echo.Context) error {
	roles, err := h.serverStore.ListRoles()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list roles"})
	}
	return c.JSON(http.StatusOK, roles)
}

// CreateRole creates a new role
func (h *Handler) CreateRole(c echo.Context) error {
	var req CreateRoleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "role name is required"})
	}

	role, err := h.serverStore.CreateRole(req.Name, req.Color, req.IconURL, req.Permissions)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create role"})
	}

	if h.hub != nil {
		h.hub.BroadcastAll("role_created", role)
	}

	return c.JSON(http.StatusCreated, role)
}

// UpdateRole updates an existing role
func (h *Handler) UpdateRole(c echo.Context) error {
	roleID := c.Param("id")
	var req CreateRoleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "role name is required"})
	}

	role, err := h.serverStore.UpdateRole(roleID, req.Name, req.Color, req.IconURL, req.Permissions)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update role"})
	}

	if h.hub != nil {
		h.hub.BroadcastAll("role_updated", role)
	}

	return c.JSON(http.StatusOK, role)
}

// UploadRoleIcon handles POST /api/server/roles/:id/icon (Admin only)
func (h *Handler) UploadRoleIcon(c echo.Context) error {
	roleID := c.Param("id")
	fileHeader, err := c.FormFile("icon")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "icon file is required"})
	}

	if fileHeader.Size > 10*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file size must not exceed 10MB"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open uploaded file"})
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" && ext != ".svg" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "unsupported file format"})
	}

	data, err := io.ReadAll(file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file data"})
	}

	if h.cld == nil || !h.cld.IsConfigured() {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Cloudinary is not configured on the server"})
	}

	uploadResult, err := h.cld.UploadMedia(c.Request().Context(), data, fileHeader.Filename, "peace-parrot/roles")
	if err != nil {
		log.Printf("[RoleIcon] Upload error: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to upload role icon"})
	}

	oldPublicID, err := h.serverStore.UpdateRoleIcon(roleID, uploadResult.SecureURL, uploadResult.PublicID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update role icon in database"})
	}

	if oldPublicID != "" && oldPublicID != uploadResult.PublicID {
		go func() {
			if err := h.cld.DeleteMedia(context.Background(), oldPublicID); err != nil {
				log.Printf("[RoleIcon] Failed to delete previous icon %s: %v", oldPublicID, err)
			}
		}()
	}

	if h.hub != nil {
		h.hub.BroadcastAll("role_updated", map[string]interface{}{
			"id":      roleID,
			"iconUrl": uploadResult.SecureURL,
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "role icon uploaded successfully",
		"iconUrl": uploadResult.SecureURL,
	})
}

// DeleteRole deletes a role
func (h *Handler) DeleteRole(c echo.Context) error {
	roleID := c.Param("id")
	if err := h.serverStore.DeleteRole(roleID); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	if h.hub != nil {
		h.hub.BroadcastAll("role_deleted", map[string]string{"id": roleID})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "role deleted successfully"})
}

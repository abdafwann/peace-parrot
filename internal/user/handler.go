package user

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/abdafwann/peace-parrot/pkg/cloudinary"
	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

const (
	MaxAvatarSizeBytes = 10 * 1024 * 1024 // 10MB max avatar upload
	MaxBannerSizeBytes = 10 * 1024 * 1024 // 10MB max banner upload (images & animated GIFs)
)

// UserResponse represents public user information
type UserResponse struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName,omitempty"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
	BannerURL   string `json:"bannerUrl,omitempty"`
	Bio         string `json:"bio,omitempty"`
	Role        string `json:"role,omitempty"`
}

// Handler handles user HTTP requests
type Handler struct {
	store *Store
	cld   *cloudinary.Client
}

// NewHandler creates a new user handler
func NewHandler(store *Store, cld *cloudinary.Client) *Handler {
	return &Handler{
		store: store,
		cld:   cld,
	}
}

// List handles GET /api/users
func (h *Handler) List(c echo.Context) error {
	users, err := h.store.ListUsers()
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list users", nil)
	}

	response := make([]UserResponse, len(users))
	for i, u := range users {
		role := u.Role
		if role == "" {
			if i == 0 || strings.EqualFold(u.Username, "admin") || strings.EqualFold(u.Username, "afwan") || strings.EqualFold(u.Username, "gremiwo") {
				role = "Admin"
			} else {
				role = "Member"
			}
		}

		response[i] = UserResponse{
			ID:          u.ID,
			Username:    u.Username,
			DisplayName: u.DisplayName,
			AvatarURL:   u.AvatarURL,
			BannerURL:   u.BannerURL,
			Bio:         u.Bio,
			Role:        role,
		}
	}

	return c.JSON(http.StatusOK, response)
}

// UpdateProfileRequest for PATCH /api/users/me
type UpdateProfileRequest struct {
	DisplayName *string `json:"displayName"`
	AvatarURL   *string `json:"avatarUrl"`
	BannerURL   *string `json:"bannerUrl"`
	Bio         *string `json:"bio"`
}

// GetMe handles GET /api/users/me
func (h *Handler) GetMe(c echo.Context) error {
	userID, ok := c.Get("userId").(string)
	if !ok || userID == "" {
		return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
	}

	u, err := h.store.GetUserByID(userID)
	if err != nil {
		return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found", nil)
	}

	displayName := u.DisplayName
	if displayName == "" {
		displayName = u.Username
	}

	role := u.Role
	if role == "" {
		if strings.EqualFold(u.Username, "admin") || strings.EqualFold(u.Username, "afwan") || strings.EqualFold(u.Username, "gremiwo") {
			role = "Admin"
		} else {
			role = "Member"
		}
	}

	return c.JSON(http.StatusOK, UserResponse{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: displayName,
		AvatarURL:   u.AvatarURL,
		BannerURL:   u.BannerURL,
		Bio:         u.Bio,
		Role:        role,
	})
}

// UpdateMe handles PATCH /api/users/me
func (h *Handler) UpdateMe(c echo.Context) error {
	userID, ok := c.Get("userId").(string)
	if !ok || userID == "" {
		return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
	}

	var req UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	u, err := h.store.GetUserByID(userID)
	if err != nil {
		return middleware.WriteError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found", nil)
	}

	if req.DisplayName != nil {
		u.DisplayName = *req.DisplayName
	}
	if req.AvatarURL != nil {
		u.AvatarURL = *req.AvatarURL
	}
	if req.BannerURL != nil {
		u.BannerURL = *req.BannerURL
	}
	if req.Bio != nil {
		u.Bio = *req.Bio
	}

	if err := h.store.UpdateUser(u); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update profile", nil)
	}

	displayName := u.DisplayName
	if displayName == "" {
		displayName = u.Username
	}

	return c.JSON(http.StatusOK, UserResponse{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: displayName,
		AvatarURL:   u.AvatarURL,
		BannerURL:   u.BannerURL,
		Bio:         u.Bio,
		Role:        "Member",
	})
}

// UploadAvatar handles POST /api/users/me/avatar
func (h *Handler) UploadAvatar(c echo.Context) error {
	userID, ok := c.Get("userId").(string)
	if !ok || userID == "" {
		return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Image file is required", nil)
	}

	if fileHeader.Size > MaxAvatarSizeBytes {
		return middleware.WriteError(c, http.StatusBadRequest, "FILE_TOO_LARGE", fmt.Sprintf("Avatar size must be under %d KB", MaxAvatarSizeBytes/1024), nil)
	}

	src, err := fileHeader.Open()
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read file", nil)
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process file", nil)
	}

	var avatarURL string
	var avatarPublicID string

	// If Cloudinary is configured, upload to Cloudinary
	if h.cld != nil && h.cld.IsConfigured() {
		ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
		defer cancel()

		res, err := h.cld.UploadMedia(ctx, fileBytes, fileHeader.Filename, "peace-parrot/avatars")
		if err != nil {
			log.Printf("[UploadAvatar] Cloudinary upload error: %v", err)
			return middleware.WriteError(c, http.StatusInternalServerError, "CLOUDINARY_ERROR", "Failed to upload avatar to cloud storage", nil)
		}
		avatarURL = res.SecureURL
		avatarPublicID = res.PublicID
	} else {
		// Fallback for local testing without Cloudinary credentials: store as base64 data URI
		mimeType := fileHeader.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "image/png"
		}
		avatarURL = fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(fileBytes))
		avatarPublicID = ""
	}

	// Update user in DB and retrieve old public ID for deletion
	oldPublicID, err := h.store.UpdateAvatar(userID, avatarURL, avatarPublicID)
	if err != nil {
		// Rollback safety: if DB update fails, delete the newly uploaded image immediately
		if avatarPublicID != "" && h.cld != nil {
			go func() {
				_ = h.cld.DeleteMedia(context.Background(), avatarPublicID)
			}()
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update user avatar", nil)
	}

	// If old avatar had a Cloudinary public ID, delete it in background goroutine
	if oldPublicID != "" && h.cld != nil {
		go func(idToDelete string) {
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			if err := h.cld.DeleteMedia(ctx, idToDelete); err != nil {
				log.Printf("[UploadAvatar] Warning: Failed to delete old avatar %s: %v", idToDelete, err)
			}
		}(oldPublicID)
	}

	u, _ := h.store.GetUserByID(userID)
	displayName := u.DisplayName
	if displayName == "" {
		displayName = u.Username
	}

	return c.JSON(http.StatusOK, UserResponse{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: displayName,
		AvatarURL:   u.AvatarURL,
		BannerURL:   u.BannerURL,
		Bio:         u.Bio,
		Role:        "Member",
	})
}

// UploadBanner handles POST /api/users/me/banner
func (h *Handler) UploadBanner(c echo.Context) error {
	userID, ok := c.Get("userId").(string)
	if !ok || userID == "" {
		return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Banner image or animated GIF is required", nil)
	}

	if fileHeader.Size > MaxBannerSizeBytes {
		return middleware.WriteError(c, http.StatusBadRequest, "FILE_TOO_LARGE", fmt.Sprintf("Banner size must be under %d MB", MaxBannerSizeBytes/(1024*1024)), nil)
	}

	src, err := fileHeader.Open()
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read banner file", nil)
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process banner file", nil)
	}

	var bannerURL string
	var bannerPublicID string

	// If Cloudinary is configured, upload to Cloudinary
	if h.cld != nil && h.cld.IsConfigured() {
		ctx, cancel := context.WithTimeout(c.Request().Context(), 30*time.Second)
		defer cancel()

		res, err := h.cld.UploadMedia(ctx, fileBytes, fileHeader.Filename, "peace-parrot/banners")
		if err != nil {
			log.Printf("[UploadBanner] Cloudinary upload error: %v", err)
			return middleware.WriteError(c, http.StatusInternalServerError, "CLOUDINARY_ERROR", "Failed to upload banner to cloud storage", nil)
		}
		bannerURL = res.SecureURL
		bannerPublicID = res.PublicID
	} else {
		// Fallback for local testing without Cloudinary: store as base64 data URI
		mimeType := fileHeader.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "image/png"
		}
		bannerURL = fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(fileBytes))
		bannerPublicID = ""
	}

	// Update user in DB and retrieve old banner public ID
	oldPublicID, err := h.store.UpdateBanner(userID, bannerURL, bannerPublicID)
	if err != nil {
		// Rollback safety
		if bannerPublicID != "" && h.cld != nil {
			go func() {
				_ = h.cld.DeleteMedia(context.Background(), bannerPublicID)
			}()
		}
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update user banner", nil)
	}

	// Delete previous banner from Cloudinary in background goroutine
	if oldPublicID != "" && h.cld != nil {
		go func(idToDelete string) {
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			if err := h.cld.DeleteMedia(ctx, idToDelete); err != nil {
				log.Printf("[UploadBanner] Warning: Failed to delete old banner %s: %v", idToDelete, err)
			}
		}(oldPublicID)
	}

	u, _ := h.store.GetUserByID(userID)
	displayName := u.DisplayName
	if displayName == "" {
		displayName = u.Username
	}

	return c.JSON(http.StatusOK, UserResponse{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: displayName,
		AvatarURL:   u.AvatarURL,
		BannerURL:   u.BannerURL,
		Bio:         u.Bio,
		Role:        "Member",
	})
}

package user

import (
	"fmt"
	"io"
	"net/http"

	"github.com/abdafwann/peace-parrot/internal/upload"
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
	store               *Store
	cld                 *cloudinary.Client
	notifyProfileUpdate func(UserResponse)
	notifyBlocksUpdate  func(string)
}

func (h *Handler) SetProfileUpdateNotifier(notify func(UserResponse)) {
	h.notifyProfileUpdate = notify
}

func profileResponse(u *User) UserResponse {
	displayName := u.DisplayName
	if displayName == "" {
		displayName = u.Username
	}
	role := u.Role
	if role == "" {
		role = "Member"
	}
	return UserResponse{ID: u.ID, Username: u.Username, DisplayName: displayName, AvatarURL: u.AvatarURL, BannerURL: u.BannerURL, Bio: u.Bio, Role: role}
}

func (h *Handler) respondWithUpdatedProfile(c echo.Context, u *User) error {
	profile := profileResponse(u)
	if h.notifyProfileUpdate != nil {
		h.notifyProfileUpdate(profile)
	}
	return c.JSON(http.StatusOK, profile)
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
			role = "Member"
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
		role = "Member"
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

	return h.respondWithUpdatedProfile(c, u)
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

	avatarURL, err := upload.SaveLocalFile("uploads", "avatars", fileHeader.Filename, fileBytes)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save avatar", nil)
	}

	_, err = h.store.UpdateAvatar(userID, avatarURL, "")
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update user avatar", nil)
	}

	u, err := h.store.GetUserByID(userID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read updated profile", nil)
	}
	return h.respondWithUpdatedProfile(c, u)
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

	bannerURL, err := upload.SaveLocalFile("uploads", "banners", fileHeader.Filename, fileBytes)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save banner", nil)
	}

	_, err = h.store.UpdateBanner(userID, bannerURL, "")
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update user banner", nil)
	}

	u, err := h.store.GetUserByID(userID)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read updated profile", nil)
	}
	return h.respondWithUpdatedProfile(c, u)
}

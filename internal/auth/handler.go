package auth

import (
	"net/http"
	"strings"

	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	userStore *user.Store
	jwtMgr    *JWTManager
	rateLimit *RateLimiter
}

// LoginRequest represents login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RegisterRequest represents registration request body
type RegisterRequest struct {
	InviteCode  string `json:"invite_code"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name,omitempty"`
}

// AuthResponse represents auth success response
type AuthResponse struct {
	Token string       `json:"token"`
	User  user.User    `json:"user"`
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(store *user.Store, jwtMgr *JWTManager) *AuthHandler {
	return &AuthHandler{
		userStore: store,
		jwtMgr:    jwtMgr,
		rateLimit: NewRateLimiter(DefaultRateLimit, DefaultRateWindow),
	}
}

// Login handles POST /api/auth/login
func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	// Validate input
	req.Username = strings.TrimSpace(strings.ToLower(req.Username))
	req.Password = strings.TrimSpace(req.Password)

	if req.Username == "" || req.Password == "" {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Username and password are required", nil)
	}

	// Check rate limit
	clientIP := c.RealIP()
	if !h.rateLimit.Allow(clientIP) {
		return middleware.WriteError(c, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too many login attempts. Please wait.", nil)
	}

	// Find user
	u, err := h.userStore.GetUserByUsername(req.Username)
	if err != nil {
		return middleware.WriteError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid username or password", nil)
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		return middleware.WriteError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid username or password", nil)
	}

	// Generate token
	token, err := h.jwtMgr.GenerateToken(u.ID, u.Username)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate token", nil)
	}

	return c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  *u,
	})
}

// Register handles POST /api/auth/register
func (h *AuthHandler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", nil)
	}

	// Trim and normalize
	req.Username = strings.TrimSpace(strings.ToLower(req.Username))
	req.Password = strings.TrimSpace(req.Password)
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	// Validate username
	if err := ValidateUsername(req.Username); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "USERNAME_INVALID", err.Error(), nil)
	}

	// Validate password
	if err := ValidatePassword(req.Password); err != nil {
		return middleware.WriteError(c, http.StatusBadRequest, "PASSWORD_TOO_WEAK", err.Error(), nil)
	}

	// TODO: Validate invite code
	// if req.InviteCode == "" {
	//     return middleware.WriteError(c, http.StatusBadRequest, "INVITE_REQUIRED", "Invite code is required", nil)
	// }

	// Check if username exists
	existing, _ := h.userStore.GetUserByUsername(req.Username)
	if existing != nil {
		return middleware.WriteError(c, http.StatusConflict, "USERNAME_TAKEN", "Username is already taken", nil)
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process password", nil)
	}

	// Create user
	newUser := &user.User{
		Username:     req.Username,
		PasswordHash: string(hash),
		DisplayName:  req.DisplayName,
	}

	if err := h.userStore.CreateUser(newUser); err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create user", nil)
	}

	// Generate token
	token, err := h.jwtMgr.GenerateToken(newUser.ID, newUser.Username)
	if err != nil {
		return middleware.WriteError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to generate token", nil)
	}

	return c.JSON(http.StatusCreated, AuthResponse{
		Token: token,
		User:  *newUser,
	})
}

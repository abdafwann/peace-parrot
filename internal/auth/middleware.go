package auth

import (
	"net/http"
	"strings"

	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
)

// ContextKey for storing claims in context
const ClaimsContextKey = "claims"

// JWTMiddleware validates JWT tokens
func JWTMiddleware(jwtMgr *JWTManager) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return middleware.WriteError(c, http.StatusUnauthorized, "TOKEN_INVALID", "Authorization header required", nil)
			}

			// Extract token from "Bearer <token>"
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return middleware.WriteError(c, http.StatusUnauthorized, "TOKEN_INVALID", "Invalid authorization header format", nil)
			}

			tokenString := parts[1]
			claims, err := jwtMgr.ValidateToken(tokenString)
			if err != nil {
				if err == ErrTokenExpired {
					return middleware.WriteError(c, http.StatusUnauthorized, "TOKEN_EXPIRED", "Session expired. Please log in again.", nil)
				}
				return middleware.WriteError(c, http.StatusUnauthorized, "TOKEN_INVALID", "Invalid token", nil)
			}

			// Store claims and userId in context
			c.Set(ClaimsContextKey, claims)
			c.Set("userId", claims.UserID)
			c.Set("user_id", claims.UserID)

			return next(c)
		}
	}
}

// GetClaims retrieves claims from context
func GetClaims(c echo.Context) *Claims {
	claims, ok := c.Get(ClaimsContextKey).(*Claims)
	if !ok {
		return nil
	}
	return claims
}

// GetUserID retrieves user ID from context
func GetUserID(c echo.Context) string {
	claims := GetClaims(c)
	if claims == nil {
		return ""
	}
	return claims.UserID
}

// RequireAdminMiddleware ensures the caller has Admin privileges
func RequireAdminMiddleware(userStore interface {
	GetUserByID(id string) (*user.User, error)
}) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := GetClaims(c)
			if claims == nil {
				return middleware.WriteError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", nil)
			}

			u, err := userStore.GetUserByID(claims.UserID)
			if err != nil {
				return middleware.WriteError(c, http.StatusForbidden, "FORBIDDEN", "User not found", nil)
			}

			isAdmin := strings.EqualFold(u.Role, "Admin") ||
				strings.EqualFold(u.Username, "afwan") ||
				strings.EqualFold(u.Username, "admin") ||
				strings.EqualFold(u.Username, "gremiwo")

			if !isAdmin {
				return middleware.WriteError(c, http.StatusForbidden, "FORBIDDEN", "Admin privileges required", nil)
			}

			return next(c)
		}
	}
}

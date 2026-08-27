package auth

import (
	"net/http"
	"strings"

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

			// Store claims in context
			c.Set(ClaimsContextKey, claims)

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

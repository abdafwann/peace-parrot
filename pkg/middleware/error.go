package middleware

import (
	"log"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/labstack/echo/v4"
)

// APIError represents a structured API error
type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// ErrorResponse wraps error for JSON response
type ErrorResponse struct {
	Error APIError `json:"error"`
}

// NewAPIError creates a new APIError
func NewAPIError(code, message string, details interface{}) APIError {
	return APIError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

// WriteError writes a structured error response
func WriteError(c echo.Context, statusCode int, code, message string, details interface{}) error {
	return c.JSON(statusCode, ErrorResponse{
		Error: NewAPIError(code, message, details),
	})
}

// Error codes
const (
	ErrInternal      = "INTERNAL_ERROR"
	ErrValidation    = "VALIDATION_ERROR"
	ErrUnauthorized  = "UNAUTHORIZED"
	ErrForbidden     = "FORBIDDEN"
	ErrNotFound      = "NOT_FOUND"
	ErrConflict      = "CONFLICT"
	ErrRateLimited   = "RATE_LIMIT_EXCEEDED"
)

// PanicRecoveryMiddleware catches panics and returns a generic 500 error
func PanicRecoveryMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		defer func() {
			if err := recover(); err != nil {
				// Log the panic with stack trace
				log.Printf("PANIC: %v\n%s", err, debug.Stack())

				// Return generic 500 error
				_ = WriteError(c, http.StatusInternalServerError, ErrInternal, "An unexpected error occurred", nil)
			}
		}()
		return next(c)
	}
}

// RequestLoggerMiddleware logs incoming requests
func RequestLoggerMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		start := time.Now()

		err := next(c)

		duration := time.Since(start)

		// Log format: timestamp | status | method path | ip | duration
		log.Printf("%s | %d | %s %s | %s | %s",
			time.Now().Format("2006-01-02 15:04:05"),
			c.Response().Status,
			c.Request().Method,
			c.Request().URL.Path,
			c.RealIP(),
			duration,
		)

		return err
	}
}

// CORS middleware for API endpoints
func CORSMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("Access-Control-Allow-Origin", "*")
			c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if c.Request().Method == "OPTIONS" {
				return c.NoContent(http.StatusNoContent)
			}

			return next(c)
		}
	}
}

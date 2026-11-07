package upload

import "github.com/labstack/echo/v4"

// RegisterPrivateFiles serves local uploads only after authentication.
func RegisterPrivateFiles(e *echo.Echo, dir string, requireAuth echo.MiddlewareFunc) {
	group := e.Group("/uploads", requireAuth, func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("Cache-Control", "private, no-store")
			c.Response().Header().Set("X-Content-Type-Options", "nosniff")
			return next(c)
		}
	})
	group.Static("/", dir)
}

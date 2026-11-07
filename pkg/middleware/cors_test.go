package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestCORSAllowsBlockPut(t *testing.T) {
	e := echo.New()
	e.Use(CORSMiddleware("https://example.com"))
	e.PUT("/api/users/me/blocks/id", func(c echo.Context) error { return c.NoContent(http.StatusNoContent) })
	req := httptest.NewRequest(http.MethodOptions, "/api/users/me/blocks/id", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Method", "PUT")
	response := httptest.NewRecorder()
	e.ServeHTTP(response, req)
	if !strings.Contains(response.Header().Get("Access-Control-Allow-Methods"), "PUT") {
		t.Fatal("CORS preflight does not allow PUT")
	}
}

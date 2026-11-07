package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestFrontendAssetsAreServed(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "app.css"), []byte("body { color: red; }"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "app.js"), []byte("console.log('ok')"), 0600); err != nil {
		t.Fatal(err)
	}
	e := echo.New()
	registerFrontendAssets(e, root)
	e.GET("/*", func(c echo.Context) error { return c.String(http.StatusOK, "index") })
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/assets/app.css", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Content-Type"), "text/css") || rec.Body.String() != "body { color: red; }" {
		t.Fatalf("status=%d content-type=%q body=%q", rec.Code, rec.Header().Get("Content-Type"), rec.Body.String())
	}
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/assets/app.js", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Content-Type"), "javascript") || rec.Body.String() != "console.log('ok')" {
		t.Fatalf("status=%d content-type=%q body=%q", rec.Code, rec.Header().Get("Content-Type"), rec.Body.String())
	}
}

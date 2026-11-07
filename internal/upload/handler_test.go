package upload

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/abdafwann/peace-parrot/pkg/cloudinary"
	"github.com/labstack/echo/v4"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestUploadNeverUsesCloudinary(t *testing.T) {
	old := http.DefaultTransport
	remoteRequests := 0
	http.DefaultTransport = roundTripFunc(func(*http.Request) (*http.Response, error) {
		remoteRequests++
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"secure_url":"https://example.com/image"}`)), Header: make(http.Header)}, nil
	})
	defer func() { http.DefaultTransport = old }()
	cld := cloudinary.NewClient(cloudinary.Config{CloudName: "test", APIKey: "test", APISecret: "test"})
	h := NewHandler(cld, t.TempDir())
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	file, err := w.CreateFormFile("file", "file.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = file.Write([]byte("private"))
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/upload", &body)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec := httptest.NewRecorder()
	if err := h.UploadFile(echo.New().NewContext(req, rec)); err != nil {
		t.Fatal(err)
	}
	if remoteRequests != 0 {
		t.Fatalf("made %d external requests", remoteRequests)
	}
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "/uploads/") {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

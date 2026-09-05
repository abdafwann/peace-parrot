package upload

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/pkg/cloudinary"
	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

const MaxUploadSize = 10 * 1024 * 1024 // 10 MB

// Whitelist of permissible file extensions to prevent arbitrary file upload vulnerabilities (such as HTML/JS execution or executable storage)
var allowedExtensions = map[string]bool{
	// Images
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".svg":  true,
	".ico":  true,
	// Audio & Soundboard
	".mp3":  true,
	".wav":  true,
	".ogg":  true,
	".m4a":  true,
	".aac":  true,
	".flac": true,
	// Video
	".mp4":  true,
	".webm": true,
	".mov":  true,
	// Documents
	".pdf":  true,
	".txt":  true,
}

type Handler struct {
	cld       *cloudinary.Client
	uploadDir string
}

func NewHandler(cld *cloudinary.Client, uploadDir string) *Handler {
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	_ = os.MkdirAll(uploadDir, 0755)
	return &Handler{
		cld:       cld,
		uploadDir: uploadDir,
	}
}

type FileResponse struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	Type     string `json:"type"` // "image", "video", "audio", "file"
	MimeType string `json:"mimeType"`
}

func (h *Handler) UploadFile(c echo.Context) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file is required in form-data"})
	}

	if fileHeader.Size > MaxUploadSize {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file size exceeds 10MB limit"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file"})
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file content"})
	}

	fileID := uuid.New().String()
	originalName := fileHeader.Filename
	ext := strings.ToLower(filepath.Ext(originalName))

	// Validate extension against whitelist to avoid stored XSS or remote execution payloads
	if !allowedExtensions[ext] {
		return middleware.WriteError(c, http.StatusBadRequest, "VALIDATION_ERROR", "File type is not permitted", nil)
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}

	userID := auth.GetUserID(c)
	log.Printf("[upload] user=%s uploaded filename=%q size=%d mime=%s", userID, originalName, fileHeader.Size, mimeType)

	fileType := "file"
	if strings.HasPrefix(mimeType, "image/") {
		fileType = "image"
	} else if strings.HasPrefix(mimeType, "video/") {
		fileType = "video"
	} else if strings.HasPrefix(mimeType, "audio/") {
		fileType = "audio"
	}

	// 1. Try Cloudinary if configured
	if h.cld != nil && h.cld.IsConfigured() {
		res, err := h.cld.UploadMedia(c.Request().Context(), data, originalName, "peace-parrot/attachments")
		if err == nil && res.SecureURL != "" {
			return c.JSON(http.StatusOK, FileResponse{
				ID:       fileID,
				URL:      res.SecureURL,
				Filename: originalName,
				Size:     fileHeader.Size,
				Type:     fileType,
				MimeType: mimeType,
			})
		}
	}

	// 2. Local Disk Fallback
	safeExt := filepath.Ext(originalName)
	savedFileName := fmt.Sprintf("%s%s", fileID, safeExt)
	destPath := filepath.Join(h.uploadDir, savedFileName)

	if err := os.WriteFile(destPath, data, 0644); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file locally"})
	}

	scheme := "http"
	if c.IsTLS() || c.Request().Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := c.Request().Host
	if host == "" {
		host = "localhost:8080"
	}
	localURL := fmt.Sprintf("%s://%s/uploads/%s", scheme, host, savedFileName)

	return c.JSON(http.StatusOK, FileResponse{
		ID:       fileID,
		URL:      localURL,
		Filename: originalName,
		Size:     fileHeader.Size,
		Type:     fileType,
		MimeType: mimeType,
	})
}

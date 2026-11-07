package upload

import (
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/abdafwann/peace-parrot/pkg/cloudinary"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

const MaxUploadSize = 10 * 1024 * 1024 // 10 MB

type Handler struct {
	uploadDir string
}

func NewHandler(_ *cloudinary.Client, uploadDir string) *Handler {
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	_ = os.MkdirAll(uploadDir, 0755)
	return &Handler{
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

	data, err := io.ReadAll(io.LimitReader(file, MaxUploadSize+1))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file content"})
	}
	if len(data) > MaxUploadSize {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file size exceeds 10MB limit"})
	}

	fileID := uuid.New().String()
	originalName := fileHeader.Filename
	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}

	fileType := "file"
	if strings.HasPrefix(mimeType, "image/") {
		fileType = "image"
	} else if strings.HasPrefix(mimeType, "video/") {
		fileType = "video"
	} else if strings.HasPrefix(mimeType, "audio/") {
		fileType = "audio"
	}

	localURL, err := SaveLocalFile(h.uploadDir, "", originalName, data)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file locally"})
	}

	return c.JSON(http.StatusOK, FileResponse{
		ID:       fileID,
		URL:      localURL,
		Filename: originalName,
		Size:     fileHeader.Size,
		Type:     fileType,
		MimeType: mimeType,
	})
}

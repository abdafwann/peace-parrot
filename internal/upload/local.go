package upload

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// SaveLocalFile stores a file under the configured upload directory.
func SaveLocalFile(root, category, filename string, data []byte) (string, error) {
	if category != "" && (category == "." || category == ".." || filepath.Base(category) != category || strings.ContainsAny(category, `/\`)) {
		return "", fmt.Errorf("invalid upload category")
	}
	ext := strings.ToLower(filepath.Ext(filepath.Base(filename)))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm", ".pdf", ".txt", ".zip":
	default:
		ext = ".bin"
	}
	directory := filepath.Join(root, category)
	if err := os.MkdirAll(directory, 0700); err != nil {
		return "", err
	}
	name := uuid.NewString() + ext
	if err := os.WriteFile(filepath.Join(directory, name), data, 0600); err != nil {
		return "", err
	}
	return path.Join("/uploads", category, name), nil
}

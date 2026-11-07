package upload

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveLocalFileStoresInsideDirectory(t *testing.T) {
	dir := t.TempDir()
	url, err := SaveLocalFile(dir, "avatars", "../../avatar.png", []byte("test"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(url, "/uploads/avatars/") || !strings.HasSuffix(url, ".png") {
		t.Fatalf("unexpected URL %q", url)
	}
	data, err := os.ReadFile(filepath.Join(dir, "avatars", filepath.Base(url)))
	if err != nil || string(data) != "test" {
		t.Fatalf("saved data = %q, error = %v", data, err)
	}
}

func TestSaveLocalFileDoesNotServeActiveContent(t *testing.T) {
	url, err := SaveLocalFile(t.TempDir(), "", "payload.html", []byte("<script>"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(url, ".bin") {
		t.Fatalf("unsafe extension in %q", url)
	}
}

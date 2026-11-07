package config

import "testing"

func TestDefaultOriginsIncludeTauriWindows(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	cfg := Load()
	for _, origin := range cfg.Server.AllowedOrigins {
		if origin == "http://tauri.localhost" {
			return
		}
	}
	t.Fatal("default origins exclude the Tauri v2 Windows origin")
}

func TestRejectsKnownDefaultJWTSecret(t *testing.T) {
	cfg := &Config{JWT: JWTConfig{Secret: "changeme-production-super-secret-key-64bytes"}}
	if err := cfg.Validate(); err == nil {
		t.Fatal("accepted a publicly known default secret")
	}
}

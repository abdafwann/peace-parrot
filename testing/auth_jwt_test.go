package testing

import (
	"testing"

	"github.com/abdafwann/peace-parrot/internal/auth"
)

func TestJWTManager_GenerateAndValidateToken(t *testing.T) {
	mgr := auth.NewJWTManager("test-secret-key", 7)

	// Generate token
	token, err := mgr.GenerateToken("user123", "testuser")
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}
	if token == "" {
		t.Error("GenerateToken() returned empty token")
	}

	// Validate token
	claims, err := mgr.ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken() error = %v", err)
	}

	if claims.UserID != "user123" {
		t.Errorf("claims.UserID = %q, want %q", claims.UserID, "user123")
	}
	if claims.Username != "testuser" {
		t.Errorf("claims.Username = %q, want %q", claims.Username, "testuser")
	}
}

func TestJWTManager_InvalidToken(t *testing.T) {
	mgr := auth.NewJWTManager("test-secret-key", 7)

	tests := []struct {
		name  string
		token string
	}{
		{"empty token", ""},
		{"random string", "random.invalid.token"},
		{"wrong signature", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlcjEyMyJ9.wrongsignature"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := mgr.ValidateToken(tt.token)
			if err == nil {
				t.Error("ValidateToken() expected error, got nil")
			}
		})
	}
}

func TestJWTManager_DifferentSecrets(t *testing.T) {
	mgr1 := auth.NewJWTManager("secret1", 7)
	mgr2 := auth.NewJWTManager("secret2", 7)

	// Generate with first secret
	token, err := mgr1.GenerateToken("user123", "testuser")
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	// Try to validate with second secret
	_, err = mgr2.ValidateToken(token)
	if err == nil {
		t.Error("ValidateToken() should fail with different secret")
	}
}

func TestJWTManager_Expiry(t *testing.T) {
	// Create manager with 7 days expiry (standard)
	mgr := auth.NewJWTManager("test-secret", 7)

	token, err := mgr.GenerateToken("user123", "testuser")
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	// Should be valid immediately
	claims, err := mgr.ValidateToken(token)
	if err != nil {
		t.Errorf("ValidateToken() error = %v", err)
	}
	if claims.UserID != "user123" {
		t.Errorf("claims.UserID = %q, want %q", claims.UserID, "user123")
	}
}

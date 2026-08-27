package auth

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrTokenExpired = errors.New("token has expired")
	ErrTokenInvalid = errors.New("token is invalid")
)

// Claims represents JWT claims
type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// JWTManager handles JWT operations
type JWTManager struct {
	secret []byte
	expiry time.Duration
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(secret string, expiryDays int) *JWTManager {
	return &JWTManager{
		secret: []byte(secret),
		expiry: time.Duration(expiryDays) * 24 * time.Hour,
	}
}

// GenerateToken creates a new JWT for a user
func (m *JWTManager) GenerateToken(userID, username string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "peace-parrot",
			Subject:   userID,
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// ValidateToken parses and validates a JWT
func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrTokenInvalid
		}
		return m.secret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrTokenInvalid
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrTokenInvalid
	}

	return claims, nil
}

// GetJWTSecret returns JWT secret from environment or default
func GetJWTSecret() string {
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		return secret
	}
	return "changeme-in-production"
}

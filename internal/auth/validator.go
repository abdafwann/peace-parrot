package auth

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"regexp"
	"unicode"
)

var (
	ErrInvalidUsername   = errors.New("invalid username")
	ErrWeakPassword     = errors.New("password does not meet requirements")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// usernameRegex validates username format
var usernameRegex = regexp.MustCompile(`^[a-z][a-z0-9_]{2,31}$`)

// ValidateUsername checks if username meets requirements
func ValidateUsername(username string) error {
	if len(username) < 3 || len(username) > 32 {
		return fmt.Errorf("%w: must be 3-32 characters", ErrInvalidUsername)
	}

	if !usernameRegex.MatchString(username) {
		return fmt.Errorf("%w: must start with letter, contain only letters, numbers, underscores", ErrInvalidUsername)
	}

	// Check for double underscores
	if containsDoubleUnderscore(username) {
		return fmt.Errorf("%w: cannot contain double underscores", ErrInvalidUsername)
	}

	return nil
}

// containsDoubleUnderscore checks for __ pattern
func containsDoubleUnderscore(s string) bool {
	for i := 0; i < len(s)-1; i++ {
		if s[i] == '_' && s[i+1] == '_' {
			return true
		}
	}
	return false
}

// ValidatePassword checks if password meets requirements
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("%w: must be at least 8 characters", ErrWeakPassword)
	}

	var hasLetter, hasNumber, hasSymbol bool
	for _, c := range password {
		switch {
		case unicode.IsLetter(c):
			hasLetter = true
		case unicode.IsNumber(c):
			hasNumber = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSymbol = true
		}
	}

	if !hasLetter {
		return fmt.Errorf("%w: must contain at least one letter", ErrWeakPassword)
	}
	if !hasNumber {
		return fmt.Errorf("%w: must contain at least one number", ErrWeakPassword)
	}
	if !hasSymbol {
		return fmt.Errorf("%w: must contain at least one symbol", ErrWeakPassword)
	}

	return nil
}

// ConstantTimeCompare performs constant-time string comparison
func ConstantTimeCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

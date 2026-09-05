package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

// Config holds all application configuration
type Config struct {
	Server     ServerConfig
	Database   DatabaseConfig
	JWT        JWTConfig
	Cloudinary CloudinaryConfig
}

// ServerConfig holds HTTP server settings
type ServerConfig struct {
	Port         string
	ReadTimeout  int // seconds
	WriteTimeout int // seconds
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Path          string
	MigrationsDir string
}

// JWTConfig holds JWT settings
type JWTConfig struct {
	Secret string
	Expiry int // days
}

// CloudinaryConfig holds Cloudinary settings
type CloudinaryConfig struct {
	CloudName string
	APIKey    string
	APISecret string
}

// loadDotEnv loads environment variables from a .env file if it exists
func loadDotEnv(filename string) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			val = strings.Trim(val, `"'`)
			if key != "" && os.Getenv(key) == "" {
				_ = os.Setenv(key, val)
			}
		}
	}
}

// Load reads configuration from environment variables (loading .env if present)
func Load() *Config {
	loadDotEnv(".env")

	jwtSecret := os.Getenv("JWT_SECRET")
	// Prevent using well-known default secrets that compromise token integrity
	if jwtSecret == "changeme-in-production" || jwtSecret == "changeme-in-production-use-strong-secret" {
		jwtSecret = ""
	}

	// Generate a secure ephemeral secret in memory if none provided, ensuring tokens cannot be forged via static defaults
	if jwtSecret == "" {
		randomBytes := make([]byte, 32)
		if _, err := rand.Read(randomBytes); err == nil {
			jwtSecret = hex.EncodeToString(randomBytes)
			log.Println("[config] WARNING: JWT_SECRET not configured. Generated ephemeral secret for this session.")
		} else {
			jwtSecret = "fallback-ephemeral-secret-random-32chars"
		}
	}

	return &Config{
		Server: ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  getEnvInt("SERVER_READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("SERVER_WRITE_TIMEOUT", 30),
		},
		Database: DatabaseConfig{
			Path:          getEnv("DB_PATH", "./peace-parrot.db"),
			MigrationsDir: getEnv("MIGRATIONS_PATH", "./migrations"),
		},
		JWT: JWTConfig{
			Secret: jwtSecret,
			Expiry: getEnvInt("JWT_EXPIRY_DAYS", 7),
		},
		Cloudinary: CloudinaryConfig{
			CloudName: getEnv("CLOUDINARY_CLOUD_NAME", ""),
			APIKey:    getEnv("CLOUDINARY_API_KEY", ""),
			APISecret: getEnv("CLOUDINARY_API_SECRET", ""),
		},
	}
}

// Validate ensures runtime prerequisites are satisfied before server startup
func (c *Config) Validate() error {
	if len(c.JWT.Secret) < 16 {
		return fmt.Errorf("JWT secret length must be at least 16 characters for cryptographic safety")
	}
	return nil
}

// getEnv returns environment variable or default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt returns environment variable as int or default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

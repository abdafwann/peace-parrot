package config

import (
	"os"
	"strconv"
)

// Config holds all application configuration
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
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

// Load reads configuration from environment variables
func Load() *Config {
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
			Secret: getEnv("JWT_SECRET", "changeme-in-production"),
			Expiry: getEnvInt("JWT_EXPIRY_DAYS", 7),
		},
		Cloudinary: CloudinaryConfig{
			CloudName: getEnv("CLOUDINARY_CLOUD_NAME", ""),
			APIKey:    getEnv("CLOUDINARY_API_KEY", ""),
			APISecret: getEnv("CLOUDINARY_API_SECRET", ""),
		},
	}
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

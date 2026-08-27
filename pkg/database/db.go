package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// DB wraps the sql.DB connection pool
type DB struct {
	*sql.DB
}

// New creates a new database connection with WAL mode
func New(dbPath string) (*DB, error) {
	// Open with WAL mode
	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(1) // SQLite only allows one writer
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(time.Hour)

	// Verify connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{DB: db}, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.DB.Close()
}

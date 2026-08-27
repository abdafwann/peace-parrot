CREATE TABLE IF NOT EXISTS server_settings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT,
    owner_id TEXT NOT NULL,
    invite_expiry_default INTEGER,
    slow_mode_seconds INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

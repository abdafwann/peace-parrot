CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('text', 'voice')),
    topic TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_channels_type ON channels(type);
CREATE INDEX idx_channels_position ON channels(position);

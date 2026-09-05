CREATE TABLE IF NOT EXISTS soundboard_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🎵',
    category TEXT NOT NULL DEFAULT 'custom',
    duration TEXT DEFAULT 'SFX',
    custom_url TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

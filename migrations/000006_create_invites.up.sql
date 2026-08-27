CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL,
    expires_at DATETIME,
    used INTEGER NOT NULL DEFAULT 0,
    used_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (used_by) REFERENCES users(id)
);

CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_used ON invites(used);

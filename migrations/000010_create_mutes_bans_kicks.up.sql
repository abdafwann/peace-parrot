CREATE TABLE IF NOT EXISTS mutes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    muted_by TEXT NOT NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (muted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    banned_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (banned_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS kicks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kicked_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (kicked_by) REFERENCES users(id)
);

CREATE TABLE user_blocks (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_id, target_id),
    CHECK (owner_id <> target_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME,
    deleted_at DATETIME,
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_author_id ON messages(author_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

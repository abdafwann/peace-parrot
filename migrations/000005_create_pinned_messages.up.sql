CREATE TABLE IF NOT EXISTS pinned_messages (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    pinned_by TEXT NOT NULL,
    pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (pinned_by) REFERENCES users(id)
);

CREATE INDEX idx_pinned_messages_message_id ON pinned_messages(message_id);

CREATE TABLE IF NOT EXISTS channel_read_state (
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    last_message_id TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, channel_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (last_message_id) REFERENCES messages(id)
);

CREATE INDEX idx_channel_read_state_user_id ON channel_read_state(user_id);

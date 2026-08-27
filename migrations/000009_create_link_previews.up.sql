CREATE TABLE IF NOT EXISTS link_previews (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    image_url TEXT,
    site_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX idx_link_previews_message_id ON link_previews(message_id);
CREATE INDEX idx_link_previews_url ON link_previews(url);

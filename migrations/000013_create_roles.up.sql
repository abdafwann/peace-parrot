CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#5865F2',
    position INTEGER NOT NULL DEFAULT 0,
    permissions INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default standard roles
INSERT OR IGNORE INTO roles (id, name, color, position, permissions, created_at, updated_at)
VALUES 
    ('role-admin', 'Admin', '#5865F2', 1, 1023, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role-mod', 'Moderator', '#FEE75C', 2, 511, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role-member', 'Member', '#99AAB5', 3, 67, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

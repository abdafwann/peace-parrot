ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Member';
ALTER TABLE server_settings ADD COLUMN icon_public_id TEXT;
ALTER TABLE server_settings ADD COLUMN description TEXT;

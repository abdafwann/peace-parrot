ALTER TABLE roles ADD COLUMN icon_url TEXT NOT NULL DEFAULT '';
ALTER TABLE roles ADD COLUMN icon_public_id TEXT NOT NULL DEFAULT '';

-- Set default crown icon for admin and shield for moderator
UPDATE roles SET icon_url = '👑' WHERE id = 'role-admin' OR name = 'Admin';
UPDATE roles SET icon_url = '🛡️' WHERE id = 'role-mod' OR name = 'Moderator';

-- Ensure gremiwo has Admin role
UPDATE users SET role = 'Admin' WHERE username = 'gremiwo' OR username = 'admin' OR username = 'afwan';

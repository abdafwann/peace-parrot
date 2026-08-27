# PeaceParrot — Database Migrations Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec defines database migration conventions and structure.

---

## 2. Migration Tool

- **Tool:** golang-migrate
- **Execution:** Runs on server startup automatically
- **Location:** `migrations/` directory in project root

---

## 3. File Structure

```
migrations/
├── 000001_create_users.up.sql
├── 000001_create_users.down.sql
├── 000002_create_channels.up.sql
├── 000002_create_channels.down.sql
├── 000003_create_messages.up.sql
├── 000003_create_messages.down.sql
├── ...
```

**Naming convention:**
- Format: `XXXXXX_description.up.sql` / `XXXXXX_description.down.sql`
- Six-digit zero-padded prefix (prevents alphabetical sorting issues)
- Description in snake_case

---

## 4. Migration Rules

### 4.1 Immutable Files

- **Never modify** existing migration files once applied
- **Always create new** migration for schema changes
- Never delete migration files

### 4.2 Transaction Wrapping

All `up.sql` and `down.sql` files must be wrapped in transactions:

```sql
-- 000001_create_users.up.sql
BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    avatar_public_id TEXT,
    display_name TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
```

```sql
-- 000001_create_users.down.sql
BEGIN;

DROP TABLE IF EXISTS users;

COMMIT;
```

### 4.3 Testing Down Migrations

- Always test `down.sql` locally before committing
- Ensure rollback works correctly
- Verify no data loss that shouldn't happen

---

## 5. Initial Migrations

### 5.1 Required Migrations

| # | File | Description |
|---|------|-------------|
| 1 | 000001_create_users | Users table |
| 2 | 000002_create_channels | Channels table |
| 3 | 000003_create_messages | Messages table |
| 4 | 000004_create_reactions | Reactions table |
| 5 | 000005_create_pinned_messages | Pinned messages table |
| 6 | 000006_create_invites | Invites table |
| 7 | 000007_create_server_settings | Server settings table |
| 8 | 000008_create_channel_read_state | Channel read state table |
| 9 | 000009_create_link_previews | Link previews table |

### 5.2 Example Migration

**000001_create_users.up.sql:**
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    avatar_public_id TEXT,
    display_name TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);

COMMIT;
```

**000001_create_users.down.sql:**
```sql
BEGIN;

DROP TABLE IF EXISTS users;

COMMIT;
```

---

## 6. Seed Data

### 6.1 Policy

- **Do NOT** include seed data in migration files
- Seed data is injected via dedicated startup command

### 6.2 Startup Command

On first run, the server executes seed commands:

```go
// Seeder runs on startup if needed
type Seeder struct {
    db *sql.DB
}

func (s *Seeder) Seed() error {
    // Create default roles
    roles := []Role{
        {Name: "admin", Permissions: []string{"*"}},
        {Name: "moderator", Permissions: []string{"moderate", "invite"}},
        {Name: "user", Permissions: []string{"read", "write"}},
    }
    // ...
}
```

### 6.3 Why Not Migration?

| Migration Files | Seed Commands |
|----------------|---------------|
| Schema only | Data |
| Immutable | Can be re-run safely |
| Versioned | Tracked separately |

---

## 7. Adding New Migrations

### 7.1 Workflow

1. Create new migration file with next sequence number
2. Write `up.sql` with changes
3. Write `down.sql` to reverse changes
4. Test `down.sql` locally
5. Commit and deploy

### 7.2 Example: Adding avatar_url column

**000010_add_avatar_url.up.sql:**
```sql
BEGIN;

ALTER TABLE users ADD COLUMN avatar_url TEXT;

COMMIT;
```

**000010_add_avatar_url.down.sql:**
```sql
BEGIN;

ALTER TABLE users DROP COLUMN avatar_url;

COMMIT;
```

---

## 8. Migration Commands

### 8.1 CLI Commands

```bash
# Run migrations
migrate -path migrations -database sqlite://peace-parrot.db up

# Rollback last migration
migrate -path migrations -database sqlite://peace-parrot.db down 1

# Check current version
migrate -path migrations -database sqlite://peace-parrot.db version

# Force specific version
migrate -path migrations -database sqlite://peace-parrot.db force 20250826120000
```

### 8.2 Go Server Startup

```go
// Server automatically runs migrations on startup
import "github.com/golang-migrate/migrate/v4"

func RunMigrations(db *sql.DB) error {
    m, err := migrate.New(
        "file://./migrations",
        dbURL,
    )
    if err != nil {
        return err
    }
    defer m.Close()
    
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return err
    }
    return nil
}
```

---

## 9. Troubleshooting

### 9.1 Migration Failed

1. Check error message
2. Run `migrate version` to see current state
3. Fix migration file
4. Run `migrate up` again

### 9.2 Locked Database

If migration is interrupted:
```bash
# Remove lock file if exists
rm -f peace-parrot.db.lock
```

### 9.3 Broken State

If database is in broken state:
1. Backup current database
2. Run `migrate down` to rollback
3. Fix migration files
4. Run `migrate up` again

---

## 10. Checklist

- [ ] All migrations wrapped in transactions
- [ ] Down migrations tested locally
- [ ] No seed data in migration files
- [ ] Six-digit zero-padded naming
- [ ] No modification to existing migrations

---

## 11. TBD

None — all decisions finalized.

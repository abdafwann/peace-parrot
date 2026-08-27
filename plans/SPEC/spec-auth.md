# PeaceParrot — Auth System Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec covers the authentication and authorization system.

---

## 2. User Registration

### 2.1 Registration Flow

```
1. User visits /register?code=ABC123
2. Client → POST /api/auth/register
   ├── invite_code: "ABC123"
   ├── username: "afwan123"
   ├── password: "Pass@word1"
   ├── display_name: "Afwan" (optional)
   └── avatar: <file upload> (optional)
3. Server validates:
   ├── Invite code exists & not expired
   ├── Invite not already used
   ├── Username not taken
   └── Password meets requirements
4. Server creates:
   ├── User record (with hashed password)
   ├── Upload avatar to Cloudinary (if provided)
   ├── Mark invite as used
   └── Return JWT token + user profile
```

### 2.2 Username Validation

| Rule | Value |
|------|-------|
| Length | 3-32 characters |
| Characters | Letters (a-z), numbers (0-9), underscores (_) |
| Case | Case-insensitive (stored lowercase) |
| Starting char | Must start with letter |
| No double underscores | Prevent impersonation tricks |

**Valid examples:** `afwan123`, `peace_parrot`, `user_one`
**Invalid examples:** `_afwan`, `afwan__123`, `afwan-123`

### 2.3 Password Requirements

| Rule | Value |
|------|-------|
| Min length | 8 characters |
| Must include | At least 1 letter |
| Must include | At least 1 number |
| Must include | At least 1 symbol |
| Hashing | bcrypt, cost factor 12 |

### 2.4 Display Name & Bio

| Field | Max length | Required |
|-------|------------|----------|
| display_name | 20 characters | No |
| bio | 190 characters | No |

### 2.5 Avatar

| Property | Value |
|----------|-------|
| Storage | Cloudinary |
| Max file size | 256KB |
| Display size | 128x128 |
| Deletion | Delete old avatar on profile update |

---

## 3. Login / Logout

### 3.1 Login Flow

```
1. Client → POST /api/auth/login
   ├── username: "afwan123"
   └── password: "Pass@word1"
2. Server validates:
   ├── Username exists
   ├── Password matches
   └── Rate limit not exceeded
3. Server returns:
   └── JWT token + user profile
```

### 3.2 Rate Limiting

| Property | Value |
|----------|-------|
| Type | In-memory map-based |
| Limit | 5 attempts per minute per IP |
| Storage | Go map (no database) |
| On exceed | Return 429 Too Many Requests |

```go
type RateLimiter struct {
    requests  map[string]int       // IP → count
    lastReset map[string]time.Time // IP → last reset time
    mu        sync.Mutex
}
```

### 3.3 Logout

- Client-side only
- Delete JWT from localStorage/Tauri store
- No server action required

---

## 4. JWT Token

### 4.1 Token Properties

| Property | Value |
|----------|-------|
| Expiry | 7 days |
| Refresh | None (skip for v1) |
| Secret | Min 256 bits, env var |

### 4.2 Token Payload

```json
{
  "user_id": "uuid",
  "username": "afwan123",
  "role": "user"
}
```

### 4.3 Session Expiry Handling

- API returns 401 on expired token
- Frontend catches 401, shows "session expired"
- Redirect user to login screen

### 4.4 Multiple Sessions

- Each login generates independent JWT
- Stored locally on that device
- No centralized session tracking
- Users can login from multiple devices

---

## 5. Authorization

### 5.1 Role Hierarchy

```
Admin
├── Full access to everything
└── Can promote/demote moderators

Moderator
├── Cannot act on Admin
├── Cannot manage channels (create/delete)
└── Can manage users, invites, moderate content

User
├── Cannot access admin/moderator routes
└── Can only access own resources
```

### 5.2 Authorization Approach

**Hybrid: Middleware + In-Handler**

#### Middleware (Server-wide role checks)

| Middleware | Routes | Required Role |
|------------|--------|---------------|
| adminOnlyMiddleware | POST /api/channels, DELETE /api/channels/:id | Admin |
| moderatorOrAdminMiddleware | PATCH /api/channels/:id, POST /api/invites, POST /api/moderation/* | Admin or Moderator |

#### In-Handler (Resource ownership)

| Route | Check |
|-------|-------|
| PATCH /api/messages/:id | JWT user_id matches author_id |
| DELETE /api/messages/:id | JWT user_id matches author_id |
| PATCH /api/users/me | Always allowed (own profile) |
| Voice join | Always allowed (any authenticated user) |

### 5.3 Moderation Action Rules

| Action | Moderator can act on | Admin can act on |
|--------|---------------------|------------------|
| Kick | User | User, Moderator |
| Ban | User | User, Moderator |
| Mute (text) | User | User, Moderator |
| Mute (voice) | User | User, Moderator |

---

## 6. Password Security

### 6.1 Rules

| Rule | Implementation |
|------|----------------|
| Hashing | bcrypt, cost factor 12 |
| Logging | Never log (plain or hashed) |
| API response | Never return password |

### 6.2 Password Change

- Require current password
- Same validation rules for new password
- No cooldown between changes

### 6.3 Strict Prohibition

Password (plain or hashed) must never be:
- Written to server logs
- Written to debugging output
- Returned in any API response

---

## 7. Avatar Update Flow

### 7.1 Profile Update with Rollback

```
1. User uploads new avatar
2. Upload to Cloudinary → get public_id
3. Begin SQL transaction:
   ├── UPDATE user SET avatar_url, avatar_public_id WHERE id = ?
   └── Commit
4. If SQL fails:
   ├── Delete uploaded image from Cloudinary (sync, immediate)
   └── Return error to user
5. If SQL succeeds:
   ├── Delete old avatar (async, goroutine)
   └── If Cloudinary deletion times out → log error, continue
```

### 7.2 Avatar Deletion Handling

| Scenario | Action | Fail Handling |
|----------|--------|---------------|
| Upload succeeds, SQL fails | Delete uploaded immediately | N/A |
| SQL succeeds | Delete old async | Log timeout, continue |

---

## 8. TBD

None — all decisions finalized.

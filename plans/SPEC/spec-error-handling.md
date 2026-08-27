# PeaceParrot — Error Handling Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec defines error handling, logging, and error response format for the API.

---

## 2. Error Response Format

### 2.1 Standard Error Response

```json
{
  "error": {
    "code": "INVALID_PASSWORD",
    "message": "Password does not meet requirements",
    "details": {}
  }
}
```

### 2.2 Field-Level Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "username": "Username is already taken",
      "password": "Must contain at least one number"
    }
  }
}
```

### 2.3 Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `error.code` | string | Machine-readable error code (UPPERCASE_SNAKE) |
| `error.message` | string | Human-readable message |
| `error.details` | object | Optional, additional context or field errors |

---

## 3. HTTP Status Codes

| Status | Usage |
|--------|-------|
| 200 | Success |
| 201 | Resource created |
| 400 | Bad request (validation errors) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 409 | Conflict (duplicate, etc.) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 4. Error Codes

### 4.1 Authentication

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Username or password is incorrect |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `TOKEN_INVALID` | 401 | JWT token is malformed or invalid |

### 4.2 Registration

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVITE_INVALID` | 400 | Invite code does not exist |
| `INVITE_EXPIRED` | 400 | Invite code has expired |
| `INVITE_USED` | 400 | Invite code has already been used |
| `USERNAME_TAKEN` | 409 | Username is already in use |
| `USERNAME_INVALID` | 400 | Username does not meet requirements |
| `PASSWORD_TOO_WEAK` | 400 | Password does not meet requirements |

### 4.3 Channels

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `CHANNEL_NOT_FOUND` | 404 | Channel does not exist |
| `CHANNEL_ACCESS_DENIED` | 403 | User does not have access to channel |

### 4.4 Messages

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MESSAGE_NOT_FOUND` | 404 | Message does not exist |
| `MESSAGE_EDIT_DENIED` | 403 | User is not the author |
| `MESSAGE_DELETE_DENIED` | 403 | User is not the author or moderator |

### 4.5 Moderation

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `USER_NOT_FOUND` | 404 | Target user does not exist |
| `CANNOT_MODERATE_ADMIN` | 403 | Cannot moderate an admin |
| `CANNOT_MODERATE_SELF` | 400 | Cannot moderate yourself |
| `CANNOT_MODERATE_HIGHER` | 403 | Cannot moderate user with higher role |

### 4.6 Rate Limiting

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### 4.7 Generic

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `VALIDATION_ERROR` | 400 | General validation error |

---

## 5. Logging Policy

### 5.1 What to Log

| Log | Description |
|-----|-------------|
| Request path | Endpoint being called |
| Request method | HTTP method |
| IP address | Client IP |
| User ID | Authenticated user (when available) |
| Error stack traces | Full stack for errors |
| Request duration | Time taken to process |

### 5.2 What NOT to Log

| Never Log |
|-----------|
| Passwords (plain or hashed) |
| JWT tokens |
| Sensitive user data |
| Request bodies containing secrets |
| Authorization headers |

### 5.3 Example Log Entry

```
2025-08-26 10:30:45 | INFO | POST /api/auth/login | IP: 192.168.1.1 | Duration: 45ms
2025-08-26 10:30:50 | ERROR | POST /api/auth/login | IP: 192.168.1.1 | UserID: abc123 | Invalid credentials
```

---

## 6. Client-Side Error Handling

### 6.1 Error Handling Strategy

| Scenario | Action |
|----------|--------|
| 400 (VALIDATION_ERROR) | Display field-level errors inline |
| 401 (TOKEN_EXPIRED) | Redirect to login page |
| 403 (Forbidden) | Show "Access denied" toast |
| 404 (Not Found) | Show "Resource not found" message |
| 429 (Rate Limited) | Show "Please wait" message |
| 500 (Server Error) | Show "Something went wrong" toast |

### 6.2 User-Facing Messages

| Error Code | User Message |
|------------|--------------|
| `INVALID_CREDENTIALS` | "Invalid username or password" |
| `TOKEN_EXPIRED` | "Session expired. Please log in again." |
| `INVITE_INVALID` | "This invite code is invalid" |
| `INVITE_EXPIRED` | "This invite has expired" |
| `INVITE_USED` | "This invite has already been used" |
| `USERNAME_TAKEN` | "Username is already taken" |
| `RATE_LIMIT_EXCEEDED` | "Too many attempts. Please wait." |
| `INTERNAL_ERROR` | "Something went wrong. Please try again." |

---

## 7. Panic Recovery

### 7.1 Middleware

All panics must be caught by middleware:

```go
func PanicRecoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                // Log the panic
                log.Printf("PANIC: %v\n%s", err, debug.Stack())

                // Return 500
                WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred", nil)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

### 7.2 Behavior

- Middleware catches all panics
- Full stack trace logged
- Returns 500 with generic message
- Server continues running (other connections unaffected)

---

## 8. Error Response Examples

### 8.1 Login with Invalid Password

**Request:**
```
POST /api/auth/login
{
  "username": "afwan",
  "password": "wrongpassword"
}
```

**Response (401):**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password",
    "details": {}
  }
}
```

### 8.2 Registration with Multiple Errors

**Request:**
```
POST /api/auth/register
{
  "username": "admin",
  "password": "weak"
}
```

**Response (400):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "username": "Username is already taken",
      "password": "Must contain at least one number and one symbol"
    }
  }
}
```

### 8.3 Attempting to Edit Another User's Message

**Request:**
```
PATCH /api/messages/abc123
{
  "content": "Edited message"
}
```

**Response (403):**
```json
{
  "error": {
    "code": "MESSAGE_EDIT_DENIED",
    "message": "You can only edit your own messages",
    "details": {}
  }
}
```

---

## 9. TBD

None — all decisions finalized.

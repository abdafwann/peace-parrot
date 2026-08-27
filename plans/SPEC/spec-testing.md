# PeaceParrot — Testing Spec

**Parent:** peace-parrot-prd.md
**Status:** Draft
**Date:** 2025-08-26

---

## 1. Overview

This spec defines testing requirements focused on backend stability and performance.

---

## 2. Concurrency Testing

### 2.1 Race Detection

- Run `go test -race` on all tests
- **Mandatory** for any code using `sync.RWMutex` or `sync.Mutex`

```bash
# Always run with race detector
go test -race ./...

# In CI/CD pipeline
go test -race -v ./...
```

### 2.2 Concurrency Scenarios

| Scenario | Description |
|----------|-------------|
| WebSocket + WebSocket | Multiple clients sending messages simultaneously |
| WebSocket + WebRTC | Voice + chat traffic concurrent |
| WebRTC + WebRTC | Multiple voice channels active |
| SFU + SFU | Media routing concurrent load |

### 2.3 Test Coverage

- All handlers tested under concurrent load
- Voice session joins/leaves stress tested
- State mutations race-free

---

## 3. Performance Guardrails

### 3.1 Memory Limit

| Metric | Limit |
|--------|-------|
| Server RAM | **100MB hard cap** |

- Background SFU memory management must not cause micro-stutters
- Monitor with `pprof` or `runtime.ReadMemStats`

### 3.2 Load Test

```bash
# Basic load test
# Simulate 10 concurrent voice users
# Monitor memory stays under 100MB
```

### 3.3 Memory Monitoring

```go
var m runtime.MemStats
runtime.ReadMemStats(&m)
fmt.Printf("Alloc: %d KB\n", m.Alloc/1024)
```

---

## 4. Database Isolation

### 4.1 Integration Tests

Use **in-memory SQLite** for REST API integration tests:

```go
func setupTestDB(t *testing.T) *sql.DB {
    db, err := sql.Open("sqlite3", ":memory:")
    if err != nil {
        t.Fatal(err)
    }
    
    // Run migrations
    // ...
    
    return db
}

func TestCreateUser(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    
    // Test code...
}
```

### 4.2 Rules

- Never use production database for tests
- Each test gets isolated in-memory DB
- Clean state per test

---

## 5. Test Structure

```
tests/
├── unit/           # Unit tests per package
├── integration/    # REST API tests (in-memory SQLite)
└── race/          # Concurrency-specific tests
```

---

## 6. Checklist

- [ ] `go test -race` passes on all code
- [ ] All mutex usage has race tests
- [ ] Memory stays under 100MB under load
- [ ] Integration tests use in-memory SQLite
- [ ] No production DB credentials in tests

---

## 7. TBD

None — all decisions finalized.

package auth

import (
	"sync"
	"time"
)

const (
	DefaultRateLimit       = 5
	DefaultRateWindow     = time.Minute
)

// RateLimiter implements in-memory rate limiting
type RateLimiter struct {
	requests  map[string][]time.Time
	mu        sync.RWMutex
	limit     int
	window    time.Duration
	enabled   bool
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
		enabled:  true,
	}
}

// Allow checks if request is allowed for given key (typically IP)
func (rl *RateLimiter) Allow(key string) bool {
	if !rl.enabled {
		return true
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	// Get existing requests
	requests := rl.requests[key]

	// Filter out old requests
	var validRequests []time.Time
	for _, t := range requests {
		if t.After(windowStart) {
			validRequests = append(validRequests, t)
		}
	}

	// Check if limit exceeded
	if len(validRequests) >= rl.limit {
		rl.requests[key] = validRequests
		return false
	}

	// Add new request
	validRequests = append(validRequests, now)
	rl.requests[key] = validRequests

	return true
}

// Remaining returns number of remaining requests for key
func (rl *RateLimiter) Remaining(key string) int {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	requests := rl.requests[key]
	count := 0
	for _, t := range requests {
		if t.After(windowStart) {
			count++
		}
	}

	remaining := rl.limit - count
	if remaining < 0 {
		return 0
	}
	return remaining
}

// Reset clears rate limit for a key
func (rl *RateLimiter) Reset(key string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	delete(rl.requests, key)
}

// Disable turns off rate limiting
func (rl *RateLimiter) Disable() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.enabled = false
}

// Enable turns on rate limiting
func (rl *RateLimiter) Enable() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.enabled = true
}

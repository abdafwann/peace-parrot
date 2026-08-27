package testing

import (
	"testing"
	"time"

	"github.com/abdafwann/peace-parrot/internal/auth"
)

func TestRateLimiter_Allow(t *testing.T) {
	rl := auth.NewRateLimiter(3, time.Second)

	// First 3 requests should be allowed
	for i := 0; i < 3; i++ {
		if !rl.Allow("test-ip") {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// 4th request should be denied
	if rl.Allow("test-ip") {
		t.Error("4th request should be denied")
	}
}

func TestRateLimiter_DifferentIPs(t *testing.T) {
	rl := auth.NewRateLimiter(2, time.Second)

	// IP 1: 2 requests
	rl.Allow("ip1")
	rl.Allow("ip1")
	if rl.Allow("ip1") {
		t.Error("IP1 should be rate limited")
	}

	// IP 2: should still be allowed (separate limit)
	if !rl.Allow("ip2") {
		t.Error("IP2 should be allowed")
	}
}

func TestRateLimiter_WindowExpiry(t *testing.T) {
	rl := auth.NewRateLimiter(1, 50*time.Millisecond)

	// First request
	rl.Allow("test-ip")

	// Immediate second should fail
	if rl.Allow("test-ip") {
		t.Error("Second request should be denied")
	}

	// Wait for window to expire
	time.Sleep(60 * time.Millisecond)

	// Should be allowed again
	if !rl.Allow("test-ip") {
		t.Error("Request after window expiry should be allowed")
	}
}

func TestRateLimiter_Remaining(t *testing.T) {
	rl := auth.NewRateLimiter(5, time.Second)

	// Should have 5 remaining
	if remaining := rl.Remaining("test-ip"); remaining != 5 {
		t.Errorf("Remaining = %d, want 5", remaining)
	}

	// Make 2 requests
	rl.Allow("test-ip")
	rl.Allow("test-ip")

	// Should have 3 remaining
	if remaining := rl.Remaining("test-ip"); remaining != 3 {
		t.Errorf("Remaining = %d, want 3", remaining)
	}
}

func TestRateLimiter_Reset(t *testing.T) {
	rl := auth.NewRateLimiter(2, time.Second)

	// Use up limit
	rl.Allow("test-ip")
	rl.Allow("test-ip")

	// Should be denied
	if rl.Allow("test-ip") {
		t.Error("Should be rate limited")
	}

	// Reset
	rl.Reset("test-ip")

	// Should be allowed again
	if !rl.Allow("test-ip") {
		t.Error("Should be allowed after reset")
	}
}

func TestRateLimiter_Disable(t *testing.T) {
	rl := auth.NewRateLimiter(1, time.Second)

	// Disable
	rl.Disable()

	// Make many requests
	for i := 0; i < 10; i++ {
		if !rl.Allow("test-ip") {
			t.Errorf("Request %d should be allowed when disabled", i+1)
		}
	}

	// Re-enable
	rl.Enable()

	// First request should work
	if !rl.Allow("test-ip") {
		t.Error("Request should be allowed")
	}
}

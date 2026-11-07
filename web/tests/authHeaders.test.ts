import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { authenticatedRequestInit, shouldClearSession } from '../src/utils/authHeaders.ts'

test('adds bearer token to relative private API requests', () => {
  const init = authenticatedRequestInit('/api/channels', undefined, 'session-token')
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer session-token')
})

test('only clears sessions on invalid token or explicit ban', () => {
  assert.equal(shouldClearSession(401, undefined), true)
  assert.equal(shouldClearSession(403, 'USER_BANNED'), true)
  assert.equal(shouldClearSession(403, 'FORBIDDEN'), false)
  assert.equal(shouldClearSession(503, undefined), false)
})

test('does not disclose tokens to external URLs or public endpoints', () => {
  for (const url of ['https://example.com/api/channels', '/api/auth/login', '/api/invites/validate/code']) {
    const init = authenticatedRequestInit(url, undefined, 'session-token')
    assert.equal(new Headers(init?.headers).get('Authorization'), null)
  }
})

test('preserves caller headers', () => {
  const init = authenticatedRequestInit('/api/channels', { headers: { 'Content-Type': 'application/json' } }, 'session-token')
  assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/json')
})

test('refuses redirects for login and authenticated API requests', () => {
  assert.equal(authenticatedRequestInit('/api/auth/login', undefined, null)?.redirect, 'error')
  assert.equal(authenticatedRequestInit('/api/channels', undefined, 'session-token')?.redirect, 'error')
})

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isCurrentSession } from '../src/utils/sessionGuard.ts'

test('rejects an HTTP response that belongs to a previous session', () => {
  assert.equal(isCurrentSession('token-a', 'token-b'), false)
})

test('accepts an HTTP response that belongs to the current session', () => {
  assert.equal(isCurrentSession('token-a', 'token-a'), true)
})

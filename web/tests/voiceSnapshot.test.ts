import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { clearChannelParticipants } from '../src/utils/voiceSnapshot.ts'

test('a room snapshot removes stale participants only in that room', () => {
  const original = new Map([['alice', { channelId: 'one' }], ['bob', { channelId: 'two' }]])
  const result = clearChannelParticipants(original, 'one')
  assert.equal(result.has('alice'), false)
  assert.equal(result.has('bob'), true)
  assert.equal(original.has('alice'), true)
})

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { visibleMessages, remoteUserGain } from '../src/utils/blockBehavior.ts'

test('block hides existing and new messages without destroying them', () => {
  const messages = [{ authorId: 'a' }, { authorId: 'b' }, { authorId: 'b' }]
  assert.deepEqual(visibleMessages(messages, new Set(['b'])), [messages[0]])
  assert.deepEqual(visibleMessages(messages, new Set()), messages)
})

test('block, local mute and deafening independently silence remote audio', () => {
  assert.equal(remoteUserGain(true, false, false, 1, 1), 0)
  assert.equal(remoteUserGain(false, true, false, 1, 1), 0)
  assert.equal(remoteUserGain(false, false, true, 1, 1), 0)
  assert.equal(remoteUserGain(false, false, false, 0.5, 0.8), 0.4)
})

test('messages and voice remain hidden until the block list is loaded', () => {
  assert.deepEqual(visibleMessages([{ authorId: 'a' }], new Set(), false), [])
  assert.equal(remoteUserGain(false, false, false, 1, 1, false), 0)
})

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { shouldEnableMicrophone } from '../src/utils/microphoneState.ts'

test('self-mute disables microphone even while push-to-talk is pressed', () => {
  assert.equal(shouldEnableMicrophone({ pushToTalk: true, pushToTalkPressed: true, selfMuted: true }), false)
})

test('push-to-talk enables microphone only while pressed and unmuted', () => {
  assert.equal(shouldEnableMicrophone({ pushToTalk: true, pushToTalkPressed: true, selfMuted: false }), true)
  assert.equal(shouldEnableMicrophone({ pushToTalk: true, pushToTalkPressed: false, selfMuted: false }), false)
})

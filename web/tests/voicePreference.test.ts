import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { loadVoicePreference, saveVoicePreference } from '../src/utils/voicePreference.ts'

test('voice mute and deafen preferences are saved separately per user', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  saveVoicePreference(storage, 'alice', { muted: true, deafened: true })
  assert.deepEqual(loadVoicePreference(storage, 'alice'), { muted: true, deafened: true })
  assert.deepEqual(loadVoicePreference(storage, 'bob'), { muted: false, deafened: false })
})

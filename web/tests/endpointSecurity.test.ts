import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isSecureServerURL } from '../src/utils/endpointSecurity.ts'

test('only allows HTTPS or HTTP on loopback', () => {
  for (const value of ['https://chat.example', 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://[::1]:8080']) assert.equal(isSecureServerURL(value), true, value)
  for (const value of ['http://chat.example', 'http://192.168.1.5:8080', 'http://localhost.attacker.example', 'https://user:pass@chat.example', 'javascript:alert(1)']) assert.equal(isSecureServerURL(value), false, value)
})

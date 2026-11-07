import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { localUploadPath } from '../src/utils/privateMediaPath.ts'

test('recognizes relative and same-server uploads', () => {
  assert.equal(localUploadPath('/uploads/a.png', 'https://server.example'), '/uploads/a.png')
  assert.equal(localUploadPath('https://server.example/uploads/a.png', 'https://server.example'), '/uploads/a.png')
  assert.equal(localUploadPath('http://localhost:8080/uploads/legacy.png', 'https://server.example'), '/uploads/legacy.png')
})

test('never treats external or unrelated URLs as private uploads', () => {
  for (const url of ['https://other.example/uploads/a.png', '/api/users', 'data:image/png;base64,AA', '//other.example/uploads/a.png']) {
    assert.equal(localUploadPath(url, 'https://server.example'), null)
  }
})

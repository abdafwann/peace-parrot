import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { resolveMessageAuthor } from '../src/utils/messageAuthor.ts'

test('existing messages use the current profile rather than old message metadata', () => {
  const message = { authorName: 'Old name', authorAvatarUrl: '/uploads/old.png' }
  const profile = { username: 'alice', displayName: 'New name', avatarUrl: '/uploads/new.png' }
  assert.deepEqual(resolveMessageAuthor(message, profile), { name: 'New name', avatarUrl: '/uploads/new.png' })
})

test('removing an avatar does not restore the old message avatar', () => {
  assert.deepEqual(resolveMessageAuthor({ authorName: 'Old', authorAvatarUrl: '/uploads/old.png' }, { username: 'alice' }), { name: 'alice', avatarUrl: undefined })
})

test('message metadata is retained when no current profile is available', () => {
  assert.deepEqual(resolveMessageAuthor({ authorName: 'Old', authorAvatarUrl: '/old.png' }), { name: 'Old', avatarUrl: '/old.png' })
})

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { saveProfileDraft } from '../src/utils/profileDraft.ts'

test('uploads selected images before committing all profile fields once', async () => {
  const calls: { path: string; init?: RequestInit }[] = []
  const request = async (path: string, init?: RequestInit) => {
    calls.push({ path, init })
    if (path === '/api/upload') return Response.json({ url: `/uploads/${calls.length}.png` })
    return Response.json({ id: 'user', displayName: 'New' })
  }
  const avatar = new File(['avatar'], 'avatar.png', { type: 'image/png' })
  const banner = new File(['banner'], 'banner.png', { type: 'image/png' })
  const result = await saveProfileDraft({ displayName: ' New ', bio: ' Bio ', avatarUrl: '/old.png', bannerUrl: '', avatarFile: avatar, bannerFile: banner }, request)
  assert.deepEqual(calls.map(({ path }) => path), ['/api/upload', '/api/upload', '/api/users/me'])
  assert.equal((calls[0].init?.body as FormData).get('file'), avatar)
  assert.equal((calls[1].init?.body as FormData).get('file'), banner)
  assert.deepEqual(JSON.parse(calls[2].init?.body as string), { displayName: 'New', bio: 'Bio', avatarUrl: '/uploads/1.png', bannerUrl: '/uploads/2.png' })
  assert.equal(result.id, 'user')
})

test('does not update the profile when an image upload fails', async () => {
  const paths: string[] = []
  const request = async (path: string) => {
    paths.push(path)
    return Response.json({ error: 'upload failed' }, { status: 500 })
  }
  await assert.rejects(saveProfileDraft({ displayName: 'New', bio: 'Bio', avatarUrl: '', bannerUrl: '', avatarFile: new File(['x'], 'x.png') }, request))
  assert.deepEqual(paths, ['/api/upload'])
})

test('preserves existing image URLs when no new image was selected', async () => {
  let payload: unknown
  await saveProfileDraft({ displayName: 'Alice', bio: '', avatarUrl: '/existing.png', bannerUrl: '' }, async (path, init) => {
    assert.equal(path, '/api/users/me')
    payload = JSON.parse(init?.body as string)
    return Response.json({ id: 'user' })
  })
  assert.deepEqual(payload, { displayName: 'Alice', bio: '', avatarUrl: '/existing.png', bannerUrl: '' })
})

test('saves chosen avatar and banner gradients as profile values', async () => {
  const avatarUrl = 'linear-gradient(135deg, #6366f1, #0ea5e9)'
  const bannerUrl = 'linear-gradient(135deg, #09090b, #18181b, #8b5cf6)'
  await saveProfileDraft({ displayName: 'Alice', bio: '', avatarUrl, bannerUrl }, async (_path, init) => {
    assert.equal(JSON.parse(init?.body as string).avatarUrl, avatarUrl)
    assert.equal(JSON.parse(init?.body as string).bannerUrl, bannerUrl)
    return Response.json({ id: 'user', avatarUrl, bannerUrl })
  })
})

test('closing during upload prevents the profile from being committed', async () => {
  const controller = new AbortController()
  const paths: string[] = []
  await assert.rejects(saveProfileDraft({ displayName: 'New', bio: 'Bio', avatarUrl: '', bannerUrl: '', avatarFile: new File(['x'], 'x.png'), bannerFile: new File(['y'], 'y.png') }, async (path) => {
    paths.push(path)
    controller.abort()
    return Response.json({ url: '/uploads/new.png' })
  }, controller.signal), { name: 'AbortError' })
  assert.deepEqual(paths, ['/api/upload'])
})

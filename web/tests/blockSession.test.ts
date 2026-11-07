import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createBlockSession } from '../src/utils/blockSession.ts'

test('discards an old account response after session changes', async () => {
  let resolve!: (value: string[]) => void
  const session = createBlockSession()
  const old = session.load('a', () => new Promise<string[]>(r => { resolve = r }))
  session.reset('b')
  resolve(['blocked'])
  assert.equal(await old, undefined)
})

test('newer list fetch replaces older results', async () => {
  let resolve!: (value: string[]) => void
  const session = createBlockSession()
  const old = session.load('a', () => new Promise<string[]>(r => { resolve = r }))
  assert.deepEqual(await session.load('a', async () => ['new']), ['new'])
  resolve(['old'])
  assert.equal(await old, undefined)
})

test('a stale failed request does not overwrite newer session state', async () => {
  let reject!: (error: Error) => void
  const session = createBlockSession()
  const old = session.load('a', () => new Promise<string[]>((_resolve, fail) => { reject = fail }))
  assert.deepEqual(await session.load('a', async () => ['new']), ['new'])
  reject(new Error('offline'))
  assert.equal(await old, undefined)
})

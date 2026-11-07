import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { probeServerHealth } from '../src/utils/serverHealth.ts'

test('health probe avoids author-specified cross-origin headers and preserves cancellation', async () => {
  const originalFetch = globalThis.fetch
  const controller = new AbortController()
  let request: Request | undefined
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init)
    return new Response(null, { status: 200 })
  }
  try {
    const response = await probeServerHealth('https://localhost:8443', controller.signal)
    assert.equal(response.status, 200)
    assert.equal(request?.url, 'https://localhost:8443/health')
    assert.equal(request?.cache, 'no-store')
    assert.equal(request?.headers.has('Cache-Control'), false)
    controller.abort()
    assert.equal(request?.signal.aborted, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

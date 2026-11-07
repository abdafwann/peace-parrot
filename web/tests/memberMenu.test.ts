import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawn, spawnSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

test('member menu and block state work in a browser', { timeout: 30000 }, async (t) => {
  if (spawnSync('chromium', ['--version']).error) { t.skip('Chromium is not installed'); return }
  const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], { stdio: 'ignore' })
  try {
    let ready = false
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch('http://127.0.0.1:5189/tests/memberMenu.html')).ok; if (ready) break } catch {}
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, 'Vite test server did not start')
    const { stdout } = await run('chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--virtual-time-budget=5000', '--dump-dom', 'http://127.0.0.1:5189/tests/memberMenu.html'], { timeout: 20000, maxBuffer: 1024 * 1024 })
    assert.match(stdout, /<pre id="result">PASS<\/pre>/)
    const state = await run('chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--virtual-time-budget=5000', '--dump-dom', 'http://127.0.0.1:5189/tests/blockStore.html'], { timeout: 20000, maxBuffer: 1024 * 1024 })
    assert.match(state.stdout, /<pre id="result">PASS<\/pre>/)
  } finally { server.kill() }
})

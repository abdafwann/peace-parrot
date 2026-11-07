import { useAuthStore } from '../src/stores/authStore'
import { useBlockStore } from '../src/stores/blockStore'

const result = document.getElementById('result')!
async function run() {
  useAuthStore.setState({ user: { id: 'a', username: 'a' }, token: 'a', isAuthenticated: true })
  useBlockStore.getState().reset('a')
  let ids: string[] = []
  const originalFetch = window.fetch
  window.fetch = async (_input, init) => {
    if (init?.method === 'PUT') { ids = ['target']; return new Response(null, { status: 204 }) }
    if (init?.method === 'DELETE') { ids = []; return new Response(null, { status: 204 }) }
    return Response.json(ids)
  }
  try {
    await useBlockStore.getState().fetchBlocks()
    if (!useBlockStore.getState().loaded) throw new Error('List failed to load')
    if (!await useBlockStore.getState().changeBlock('target', true)) throw new Error('Block failed')
    if (!useBlockStore.getState().blocked.has('target')) throw new Error('Block absent from state')
    if (!await useBlockStore.getState().changeBlock('target', false)) throw new Error('Unblock failed')
    if (useBlockStore.getState().blocked.has('target')) throw new Error('Unblock did not clear state')
    window.fetch = async () => new Response(null, { status: 500 })
    if (await useBlockStore.getState().changeBlock('target', true)) throw new Error('Failed request reported success')
    await useBlockStore.getState().fetchBlocks()
    if (useBlockStore.getState().loaded || !useBlockStore.getState().error) throw new Error('Failed refresh must show unavailable block state')
    useBlockStore.getState().reset(null)
    if (useBlockStore.getState().loaded || useBlockStore.getState().blocked.size) throw new Error('Logout did not clear blocks')
    result.textContent = 'PASS'
  } finally { window.fetch = originalFetch }
}
run().catch(error => { result.textContent = `FAIL: ${error.message}` })

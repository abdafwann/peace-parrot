import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemberMenu } from '../src/components/MemberMenu'
import { useAuthStore } from '../src/stores/authStore'
import { useBlockStore } from '../src/stores/blockStore'

const result = document.getElementById('result')!
try {
  useAuthStore.setState({ user: { id: 'admin', username: 'admin', role: 'Admin' }, token: 'token', isAuthenticated: true })
  useBlockStore.setState({ blocked: new Set(), loaded: true, sessionToken: 'token' })
  const root = createRoot(document.getElementById('root')!)
  const member = { id: 'other', username: 'alice', displayName: 'Alice', role: 'Member', status: 'online' as const }
  let closed = false
  flushSync(() => root.render(<MemberMenu member={member} anchor={{ x: 20, y: 20 }} onClose={() => { closed = true }} />))
  const text = document.body.textContent || ''
  for (const expected of ['Alice', 'Profile', 'Mute', 'Volume', 'Roles', 'Kick', 'Ban', 'Block']) {
    if (!text.includes(expected)) throw new Error(`Missing ${expected}`)
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  if (!closed) throw new Error('Escape did not close menu')
  flushSync(() => useAuthStore.setState({ user: { id: 'viewer', username: 'viewer', role: 'Member' } }))
  const userMenu = document.querySelector('[role="dialog"]')?.textContent || ''
  if (userMenu.includes('Kick') || userMenu.includes('Ban') || userMenu.includes('Roles')) throw new Error('Moderation leaked to non-admin')
  if (!userMenu.includes('Block')) throw new Error('Block unavailable to member')
  let target = ''
  useBlockStore.setState({ changeBlock: async (id, block) => { target = `${id}:${block}`; useBlockStore.setState({ blocked: new Set([id]) }); return true } })
  const blockButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Block')
  if (!blockButton) throw new Error('Block button missing')
  flushSync(() => blockButton.click())
  if (target !== 'other:true') throw new Error(`Incorrect block target: ${target}`)
  if (!document.querySelector('[role="dialog"]')?.textContent?.includes('Unblock')) throw new Error('Block state did not update')
  flushSync(() => root.render(<MemberMenu member={{ ...member, id: 'viewer' }} anchor={{ x: 20, y: 20 }} onClose={() => {}} />))
  const selfMenu = document.querySelector('[role="dialog"]')?.textContent || ''
  if (selfMenu.includes('Block') || selfMenu.includes('Mute') || selfMenu.includes('Kick')) throw new Error('Self-actions should be hidden')
  result.textContent = 'PASS'
} catch (error) {
  result.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`
}

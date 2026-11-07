import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Member } from './MemberList'
import { PrivateImage } from './PrivateImage'
import { ConfirmModal } from './ConfirmModal'
import { useAuthStore } from '../stores/authStore'
import { useBlockStore } from '../stores/blockStore'
import { useServerStore } from '../stores/serverStore'
import { getSavedUserLocalMute, getSavedUserVolume, useVoiceStore } from '../stores/voiceStore'
import { isProfileGradient } from '../utils/profileAppearance'

interface Props { member: Member; anchor: { x: number; y: number }; onClose: () => void }
type Moderation = 'kick' | 'ban'

export function MemberMenu({ member, anchor, onClose }: Props) {
  const current = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const isSelf = current?.id === member.id
  const isAdmin = current?.role?.toLowerCase() === 'admin'
  const blocked = useBlockStore((s) => s.blocked.has(member.id))
  const loaded = useBlockStore((s) => s.loaded && s.sessionToken === token)
  const loading = useBlockStore((s) => s.loading)
  const blockError = useBlockStore((s) => s.error)
  const roles = useServerStore((s) => s.roles)
  const setVolume = useVoiceStore((s) => s.setUserVolume)
  const setLocalMute = useVoiceStore((s) => s.setUserLocalMute)
  const [volume, setVolumeState] = useState(() => Math.round(getSavedUserVolume(member.id) * 100))
  const [muted, setMuted] = useState(() => getSavedUserLocalMute(member.id))
  const [profile, setProfile] = useState(false)
  const [confirm, setConfirm] = useState<Moderation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const name = member.displayName || member.username

  useEffect(() => {
    const outside = (e: MouseEvent) => { if (!confirm && menuRef.current && !menuRef.current.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !confirm) onClose() }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key) }
  }, [confirm, onClose])

  async function perform(action: () => Promise<boolean>, success: string) {
    setBusy(true); setError(''); setMessage('')
    try { if (await action()) setMessage(success); else setError('Action failed. Please try again.') }
    catch { setError('Action failed. Please try again.') }
    finally { setBusy(false) }
  }

  const menuButton = 'w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-xs cursor-pointer disabled:opacity-50'
  return createPortal(<>
    <div ref={menuRef} role="dialog" aria-label={`User menu for ${name}`} style={{ left: Math.max(8, Math.min(anchor.x, window.innerWidth - 296)), top: Math.max(8, Math.min(anchor.y, window.innerHeight - 560)), maxHeight: 'calc(100vh - 16px)' }} className="fixed z-[900] w-[280px] overflow-y-auto rounded-2xl border border-white/10 bg-[#111722] p-2 text-slate-200 shadow-2xl">
      <div className="flex items-center gap-3 px-2 py-3 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-sky-500 font-bold text-white">{member.avatarUrl ? <PrivateImage src={member.avatarUrl} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}</div>
        <div className="min-w-0 flex-1"><div className="font-bold text-sm truncate">{name}</div><div className="text-[11px] text-slate-400 truncate">@{member.username} · {member.status}</div></div>
        <span className="text-[10px] text-emerald-300">{member.role}</span>
      </div>
      <button type="button" className={menuButton} onClick={() => setProfile(!profile)}>Profile {profile ? '▴' : '↗'}</button>
      {profile && <div className="px-3 pb-3 text-xs text-slate-300 space-y-2">
        {member.bannerUrl && (isProfileGradient(member.bannerUrl) ? <div aria-label="Profile banner" className="h-16 rounded-lg" style={{ background: member.bannerUrl }} /> : <PrivateImage src={member.bannerUrl} alt="Profile banner" className="h-16 w-full object-cover rounded-lg" />)}
        <p className="whitespace-pre-wrap">{member.bio || 'No bio yet.'}</p>
      </div>}
      {!isSelf && <>
        <div className="px-3 pt-3 text-[10px] font-bold tracking-wider text-slate-500">VOICE FOR YOU</div>
        <button type="button" className={menuButton} onClick={() => { setMuted(!muted); setLocalMute(member.id, !muted) }}>{muted ? 'Unmute locally' : 'Mute locally'}</button>
        <label className="block px-3 py-2 text-xs">Volume <span className="float-right">{volume}%</span><input aria-label="User volume" type="range" min="0" max="200" value={volume} onChange={(e) => { const value = Number(e.target.value); setVolumeState(value); setVolume(member.id, value / 100) }} className="w-full mt-2 accent-emerald-400" /></label>
        {isAdmin && <><div className="px-3 pt-3 text-[10px] font-bold tracking-wider text-slate-500">MODERATION</div>
          <label className="block px-3 py-2 text-xs">Roles <select aria-label="Roles" value={member.role} disabled={busy} onChange={(e) => void perform(() => useServerStore.getState().updateMemberRole(member.id, e.target.value), 'Role updated')} className="ml-2 bg-slate-800 rounded p-1">{roles.map(role => <option key={role.id} value={role.name}>{role.name}</option>)}</select></label>
          <button type="button" disabled={busy} className={menuButton} onClick={() => void perform(() => useServerStore.getState().muteUser(member.id), 'Admin voice mute applied')}>Admin mute voice</button>
          <button type="button" disabled={busy} className={menuButton} onClick={() => void perform(() => useServerStore.getState().unmuteUser(member.id), 'Admin voice mute removed')}>Admin unmute voice</button>
          <button type="button" disabled={busy} className={`${menuButton} text-rose-400`} onClick={() => setConfirm('kick')}>Kick</button>
          <button type="button" disabled={busy} className={`${menuButton} text-rose-400`} onClick={() => setConfirm('ban')}>Ban</button>
        </>}
        <div className="border-t border-white/10 mt-2 pt-1"><button type="button" disabled={busy || !loaded} className={`${menuButton} text-rose-400`} onClick={() => void perform(() => useBlockStore.getState().changeBlock(member.id, !blocked), blocked ? 'User unblocked' : 'User blocked')}>{blocked ? 'Unblock' : 'Block'}</button>
          {!loaded && <div className="px-3 text-xs text-slate-400">{loading ? 'Loading block status…' : blockError || 'Block status unavailable'} {!loading && <button type="button" className="text-emerald-400 underline" onClick={() => void useBlockStore.getState().fetchBlocks()}>Retry</button>}</div>}</div>
      </>}
      {error && <p role="alert" className="px-3 py-2 text-xs text-rose-400">{error}</p>}
      {message && <p role="status" className="px-3 py-2 text-xs text-emerald-400">{message}</p>}
    </div>
    <ConfirmModal isOpen={confirm !== null} title={`${confirm === 'ban' ? 'Ban' : 'Kick'} ${name}`} message={confirm === 'ban' ? 'This user cannot access the server until unbanned.' : 'This user will be disconnected.'} confirmText={confirm === 'ban' ? 'Ban Member' : 'Kick Member'} isDanger={false} loading={busy} onCancel={() => setConfirm(null)} onConfirm={() => { if (!confirm) return; const action = confirm === 'ban' ? useServerStore.getState().banUser : useServerStore.getState().kickUser; void perform(() => action(member.id), `${confirm === 'ban' ? 'Banned' : 'Kicked'} ${name}`).then(() => setConfirm(null)) }} />
  </>, document.body)
}

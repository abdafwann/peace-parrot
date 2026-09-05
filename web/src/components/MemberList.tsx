import { useState, useEffect, useMemo } from 'react'
import { Crown, Shield, Volume2, Search, Moon } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useVoiceStore } from '../stores/voiceStore'
import { useWebSocketStore } from '../stores/websocketStore'
import { useServerStore } from '../stores/serverStore'
import { RoleBadge } from './RoleBadge'
import { apiFetch } from '../utils/config'

export interface Member {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  bio?: string
  role: string
  status: 'online' | 'idle' | 'dnd' | 'offline'
  customStatus?: string
  activity?: string
}

const DEFAULT_MEMBERS: Member[] = [
  {
    id: 'admin-1',
    username: 'afwan',
    displayName: 'Afwan (Owner)',
    role: 'Admin',
    status: 'online',
    activity: 'Developing PeaceParrot',
  },
  {
    id: 'mod-1',
    username: 'Grem',
    displayName: 'Grem',
    role: 'Moderator',
    status: 'online',
    activity: 'Listening to Spotify',
  },
  {
    id: 'mod-2',
    username: 'parrot_bot',
    displayName: 'ParrotBot',
    role: 'Moderator',
    status: 'idle',
    activity: 'Automated Moderation',
  },
  {
    id: 'user-1',
    username: 'sound_enthusiast',
    displayName: 'EchoMaster',
    role: 'Member',
    status: 'online',
    activity: 'Testing SFU Audio',
  },
  {
    id: 'user-2',
    username: 'pixel_artist',
    displayName: 'PixelCat',
    role: 'Member',
    status: 'dnd',
    activity: 'Drawing Badges',
  },
  {
    id: 'user-3',
    username: 'shadow_ninja',
    displayName: 'Shadow',
    role: 'Member',
    status: 'offline',
  },
]

export function MemberList() {
  const currentUser = useAuthStore((state) => state.user)
  const isInVoice = useVoiceStore((state) => state.channelId !== null)
  const participants = useVoiceStore((state) => state.participants)
  const subscribe = useWebSocketStore((state) => state.subscribe)
  const roles = useServerStore((state) => state.roles)
  const fetchRoles = useServerStore((state) => state.fetchRoles)

  const [rawUsers, setRawUsers] = useState<any[]>([])
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Reusable function to fetch users list from backend
  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setRawUsers(data)
        }
      }
    } catch (err) {
      console.error('Failed to fetch members:', err)
    }
  }

  // Initial fetch for roles & users
  useEffect(() => {
    fetchRoles()
    fetchUsers()
  }, [currentUser])

  // Periodic polling & focus listener to ensure member list is always 100% updated in real-time
  useEffect(() => {
    const interval = setInterval(fetchUsers, 5000)
    const handleFocus = () => fetchUsers()
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // Listen for real-time WebSocket presence & role updates
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'presence_sync') {
        const payload = (msg.payload || {}) as { onlineUserIds?: string[] }
        if (Array.isArray(payload.onlineUserIds)) {
          setOnlineUserIds(new Set(payload.onlineUserIds.map((id) => id.toLowerCase())))
        }
        fetchUsers()
      } else if (msg.type === 'user_presence') {
        const payload = (msg.payload || {}) as { userId?: string; username?: string; status?: string }
        if (payload.userId) {
          setOnlineUserIds((prev) => {
            const next = new Set(prev)
            const uId = payload.userId!.toLowerCase()
            const uName = payload.username?.toLowerCase()
            if (payload.status === 'online') {
              next.add(uId)
              if (uName) next.add(uName)
            } else {
              next.delete(uId)
              if (uName) next.delete(uName)
            }
            return next
          })
          fetchUsers()
        }
      } else if (msg.type === 'user_role_updated' || msg.type === 'role_created' || msg.type === 'role_updated' || msg.type === 'role_deleted') {
        fetchRoles()
        fetchUsers()
      }
    })
    return () => unsubscribe()
  }, [subscribe])

  // Calculate live members list based on real-time presence
  const members = useMemo<Member[]>(() => {
    if (!rawUsers || rawUsers.length === 0) return DEFAULT_MEMBERS

    const currentId = currentUser?.id?.toLowerCase()
    const currentName = currentUser?.username?.toLowerCase()

    return rawUsers.map((u: any, index: number) => {
      const username = u.username || u.Username || 'user'
      const displayName = u.displayName || u.DisplayName || username
      const id = u.id || u.ID || `user-${index}`
      const lowerId = id.toLowerCase()
      const lowerName = username.toLowerCase()

      const isSelf = (currentId && lowerId === currentId) || (currentName && lowerName === currentName)
      const isOnline = isSelf || onlineUserIds.has(lowerId) || onlineUserIds.has(lowerName)

      let role: string = u.role || (index === 0 || lowerName === 'afwan' || lowerName === 'admin' ? 'Admin' : 'Member')

      return {
        id,
        username,
        displayName,
        avatarUrl: u.avatarUrl || u.AvatarURL,
        bio: u.bio || u.Bio,
        role,
        status: isOnline ? 'online' : 'offline',
        activity: isOnline ? (role === 'Admin' ? 'Managing Server' : 'Online') : 'Offline',
      }
    })
  }, [rawUsers, currentUser, onlineUserIds])

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const q = searchQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.username.toLowerCase().includes(q) ||
        m.displayName?.toLowerCase().includes(q) ||
        m.activity?.toLowerCase().includes(q)
    )
  }, [members, searchQuery])

  // Group online members dynamically by custom roles
  const roleCategories = useMemo(() => {
    const nonOffline = filteredMembers.filter((m) => m.status !== 'offline')
    const grouped: { role: string; color?: string; iconUrl?: string; members: Member[] }[] = []

    const knownRoles = roles.length > 0 ? roles : [
      { id: 'role-admin', name: 'Admin', color: '#f0b232', iconUrl: '👑' },
      { id: 'role-mod', name: 'Moderator', color: '#23a559', iconUrl: '🛡️' },
      { id: 'role-member', name: 'Member', color: '#949ba4', iconUrl: '' },
    ]

    const handledUserIds = new Set<string>()

    for (const r of knownRoles) {
      if (r.name.toLowerCase() === 'member') continue
      const roleMembers = nonOffline.filter(
        (m) => m.role?.toLowerCase() === r.name.toLowerCase() && !handledUserIds.has(m.id)
      )
      if (roleMembers.length > 0) {
        roleMembers.forEach((m) => handledUserIds.add(m.id))
        grouped.push({
          role: r.name,
          color: r.color,
          iconUrl: r.iconUrl,
          members: roleMembers,
        })
      }
    }

    // Standard Online category
    const standardOnline = nonOffline.filter((m) => !handledUserIds.has(m.id))
    if (standardOnline.length > 0) {
      grouped.push({
        role: 'Online',
        color: undefined,
        iconUrl: undefined,
        members: standardOnline,
      })
    }

    return grouped
  }, [filteredMembers, roles])

  const offlineMembers = filteredMembers.filter((m) => m.status === 'offline')

  return (
    <aside className="w-[240px] flex flex-col shrink-0 h-full select-none bg-[#0d121d]/80 border-l border-white/5">
      {/* Search Header */}
      <div className="h-14 px-3 flex items-center justify-between shrink-0 border-b border-white/5">
        {showSearch ? (
          <div className="relative w-full">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full bg-white/[0.04] text-xs text-slate-200 placeholder-slate-500 rounded-xl pl-8 pr-7 py-1.5 focus:outline-none border border-white/10 focus:border-emerald-500/40"
              autoFocus
            />
            <button
              onClick={() => {
                setSearchQuery('')
                setShowSearch(false)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Members — {members.length}
            </h3>
            <button
              onClick={() => setShowSearch(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Search members"
            >
              <Search size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Member Category List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {roleCategories.map((cat) => (
          <MemberCategory
            key={cat.role}
            title={cat.role}
            count={cat.members.length}
            icon={<RoleBadge roleName={cat.role} />}
            members={cat.members}
            currentUserId={currentUser?.id}
            currentUsername={currentUser?.username}
            isInVoice={isInVoice}
            participants={participants}
            roleColor={cat.color}
          />
        ))}

        {/* Offline Members */}
        {offlineMembers.length > 0 && (
          <MemberCategory
            title="Offline"
            count={offlineMembers.length}
            members={offlineMembers}
            currentUserId={currentUser?.id}
            currentUsername={currentUser?.username}
            isInVoice={false}
            participants={participants}
            isOffline
          />
        )}
      </div>
    </aside>
  )
}

interface MemberCategoryProps {
  title: string
  count: number
  icon?: React.ReactNode
  members: Member[]
  currentUserId?: string
  currentUsername?: string
  isInVoice?: boolean
  participants?: Map<string, any>
  roleColor?: string
  isOffline?: boolean
}

function MemberCategory({
  title,
  count,
  icon,
  members,
  currentUserId,
  currentUsername,
  isInVoice,
  participants,
  roleColor,
  isOffline,
}: MemberCategoryProps) {
  return (
    <div>
      {/* Category header */}
      <div className="flex items-center gap-1.5 px-2 mb-1">
        {icon}
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          {title} — {count}
        </span>
      </div>

      {/* Members rows */}
      <div className="space-y-0.5">
        {members.map((member) => {
          const isCurrent = Boolean(
            (currentUserId && member.id === currentUserId) ||
            (currentUsername && member.username.toLowerCase() === currentUsername.toLowerCase())
          )
          const inVoiceNow = Boolean(
            (isCurrent && isInVoice) ||
            (participants &&
              Array.from(participants.entries()).some(
                ([uid, p]) =>
                  uid === member.id ||
                  (p.username && p.username.toLowerCase() === member.username.toLowerCase())
              ))
          )

          return (
            <MemberItem
              key={member.id}
              member={member}
              inVoice={inVoiceNow}
              roleColor={roleColor}
              isOffline={isOffline}
            />
          )
        })}
      </div>
    </div>
  )
}

interface MemberItemProps {
  member: Member
  inVoice?: boolean
  roleColor?: string
  isOffline?: boolean
}

function MemberItem({ member, inVoice, roleColor, isOffline }: MemberItemProps) {
  const displayName = member.displayName || member.username
  const initial = (displayName || 'U')[0].toUpperCase()

  const roles = useServerStore((state) => state.roles)
  const userRole = roles.find(
    (r) => r.name?.toLowerCase() === member.role?.toLowerCase() || r.id === member.role
  )

  return (
    <div
      className={`
        w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 group
        ${isOffline ? 'opacity-55 hover:opacity-100' : 'hover:bg-[var(--color-bg-hover)]'}
      `}
      title={`${displayName} (${member.role})`}
    >
      {/* Avatar with Status indicator */}
      <div className="relative shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm overflow-hidden"
          style={{
            background:
              member.avatarUrl
                ? 'transparent'
                : member.role === 'Admin'
                ? 'linear-gradient(135deg, #f0b232, #f59e0b)'
                : member.role === 'Moderator'
                ? 'linear-gradient(135deg, #23a559, var(--color-parrot-cyan))'
                : 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))',
          }}
        >
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>

        {/* Status Dot */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center">
          {member.status === 'online' ? (
            <div className="w-2 h-2 rounded-full bg-[#23a559]" />
          ) : member.status === 'idle' ? (
            <Moon size={7} className="text-[#f0b232] fill-[#f0b232]" />
          ) : member.status === 'dnd' ? (
            <div className="w-2 h-2 rounded-full bg-[#ed4245]" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-[#4e5058]" />
          )}
        </div>
      </div>

      {/* Member Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span
            className="text-sm font-medium truncate"
            style={{ color: userRole?.color || roleColor || 'var(--color-text-primary)' }}
          >
            {displayName}
          </span>
          {userRole?.iconUrl ? (
            <RoleBadge role={userRole} />
          ) : (
            <>
              {member.role === 'Admin' && (
                <Crown size={12} className="text-[#f0b232] fill-[#f0b232]/20 shrink-0 ml-0.5" />
              )}
              {member.role === 'Moderator' && (
                <Shield size={12} className="text-[#23a559] shrink-0 ml-0.5" />
              )}
            </>
          )}
        </div>

        {/* Subtitle / Activity / In Voice */}
        {inVoice ? (
          <p className="text-[11px] text-[#23a559] flex items-center gap-1 font-medium truncate leading-none mt-0.5">
            <Volume2 size={10} className="shrink-0 animate-pulse" />
            <span>In voice</span>
          </p>
        ) : member.activity ? (
          <p className="text-[11px] text-[var(--color-text-muted)] truncate leading-none mt-0.5">
            {member.activity}
          </p>
        ) : null}
      </div>
    </div>
  )
}

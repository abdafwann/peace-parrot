import { useState, useEffect, useMemo } from 'react'
import { Crown, Shield, Volume2, Search, Moon } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useVoiceStore } from '../stores/voiceStore'

export interface Member {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  bio?: string
  role: 'Admin' | 'Moderator' | 'Member'
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
    activity: 'Automating channels',
  },
  {
    id: 'user-1',
    username: 'echo_user',
    displayName: 'Echo',
    role: 'Member',
    status: 'online',
    activity: 'Chilling in lobby',
  },
  {
    id: 'user-2',
    username: 'alex',
    displayName: 'Alex',
    role: 'Member',
    status: 'dnd',
    activity: 'Do Not Disturb',
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
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Fetch registered users from API and merge
  useEffect(() => {
    fetch('http://localhost:8080/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const apiMembers: Member[] = data.map((u: any, index: number) => {
            let role: 'Admin' | 'Moderator' | 'Member' = 'Member'
            if (index === 0 || u.username === 'afwan' || u.username === 'admin') role = 'Admin'
            else if (index === 1 || u.username === 'mod') role = 'Moderator'

            return {
              id: u.id,
              username: u.username,
              displayName: u.displayName || u.username,
              avatarUrl: u.avatarUrl,
              bio: u.bio,
              role,
              status: 'online',
              activity: u.bio || (role === 'Admin' ? 'Managing Server' : 'Online'),
            }
          })

          // Combine with default extra demo members if list is small
          const combined = [...apiMembers]
          DEFAULT_MEMBERS.forEach((dm) => {
            if (!combined.some((m) => m.username.toLowerCase() === dm.username.toLowerCase())) {
              combined.push(dm)
            }
          })

          setMembers(combined)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch members:', err)
      })
  }, [])

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

  // Group members by role / status
  const admins = filteredMembers.filter((m) => m.role === 'Admin' && m.status !== 'offline')
  const moderators = filteredMembers.filter((m) => m.role === 'Moderator' && m.status !== 'offline')
  const onlineMembers = filteredMembers.filter((m) => m.role === 'Member' && m.status !== 'offline')
  const offlineMembers = filteredMembers.filter((m) => m.status === 'offline')

  return (
    <aside
      className="w-[240px] flex flex-col shrink-0 h-full select-none"
      style={{
        background: 'var(--color-bg-secondary)',
        borderLeft: '1px solid var(--color-border-default)',
      }}
    >
      {/* Search Header */}
      <div className="p-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
        {showSearch ? (
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] rounded-lg pl-8 pr-7 py-1.5 focus:outline-none border border-[var(--color-border-default)]"
              autoFocus
            />
            <button
              onClick={() => {
                setSearchQuery('')
                setShowSearch(false)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Members — {members.length}
            </h3>
            <button
              onClick={() => setShowSearch(true)}
              className="p-1 rounded text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-colors"
              title="Search members"
            >
              <Search size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Member Category List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Admins */}
        {admins.length > 0 && (
          <MemberCategory
            title="Admin"
            count={admins.length}
            icon={<Crown size={12} className="text-[#f0b232] fill-[#f0b232]/20" />}
            members={admins}
            currentUserId={currentUser?.id}
            currentUsername={currentUser?.username}
            isInVoice={isInVoice}
            participants={participants}
            roleColor="#f0b232"
          />
        )}

        {/* Moderators */}
        {moderators.length > 0 && (
          <MemberCategory
            title="Moderator"
            count={moderators.length}
            icon={<Shield size={12} className="text-[#23a559]" />}
            members={moderators}
            currentUserId={currentUser?.id}
            currentUsername={currentUser?.username}
            isInVoice={isInVoice}
            participants={participants}
            roleColor="#23a559"
          />
        )}

        {/* Online Members */}
        {onlineMembers.length > 0 && (
          <MemberCategory
            title="Online"
            count={onlineMembers.length}
            members={onlineMembers}
            currentUserId={currentUser?.id}
            currentUsername={currentUser?.username}
            isInVoice={isInVoice}
            participants={participants}
          />
        )}

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
              isCurrent={isCurrent}
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
  isCurrent: boolean
  inVoice?: boolean
  roleColor?: string
  isOffline?: boolean
}

function MemberItem({ member, isCurrent, inVoice, roleColor, isOffline }: MemberItemProps) {
  const displayName = member.displayName || member.username
  const initial = (displayName || 'U')[0].toUpperCase()

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
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm"
          style={{
            background:
              member.role === 'Admin'
                ? 'linear-gradient(135deg, #f0b232, #f59e0b)'
                : member.role === 'Moderator'
                ? 'linear-gradient(135deg, #23a559, var(--color-parrot-cyan))'
                : 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))',
          }}
        >
          {initial}
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
            style={{ color: roleColor || 'var(--color-text-primary)' }}
          >
            {displayName}
          </span>
          {isCurrent && (
            <span className="text-[10px] text-[var(--color-text-muted)] font-normal">
              (you)
            </span>
          )}
          {member.role === 'Admin' && (
            <Crown size={12} className="text-[#f0b232] fill-[#f0b232]/20 shrink-0 ml-0.5" />
          )}
          {member.role === 'Moderator' && (
            <Shield size={12} className="text-[#23a559] shrink-0 ml-0.5" />
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

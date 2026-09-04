import { useState, useEffect, useRef } from 'react'
import {
  X,
  Settings,
  Hash,
  Shield,
  Users,
  Ban,
  Upload,
  Trash2,
  AlertCircle,
  Check,
  Search,
  Plus,
  UserX,
  MicOff,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useServerStore } from '../stores/serverStore'
import { useChannelStore } from '../stores/channelStore'
import { CreateChannelModal } from './CreateChannelModal'
import { RoleBadge } from './RoleBadge'
import { ConfirmModal } from './ConfirmModal'
import { toast } from '../stores/toastStore'

interface ServerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'overview' | 'channels' | 'roles' | 'members' | 'bans'

export function ServerSettingsModal({ isOpen, onClose }: ServerSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showCreateChannel, setShowCreateChannel] = useState(false)

  // Server store
  const settings = useServerStore((state) => state.settings)
  const fetchSettings = useServerStore((state) => state.fetchSettings)
  const updateSettings = useServerStore((state) => state.updateSettings)
  const uploadIcon = useServerStore((state) => state.uploadIcon)
  const bans = useServerStore((state) => state.bans)
  const fetchBans = useServerStore((state) => state.fetchBans)
  const unbanUser = useServerStore((state) => state.unbanUser)
  const banUser = useServerStore((state) => state.banUser)
  const kickUser = useServerStore((state) => state.kickUser)
  const muteUser = useServerStore((state) => state.muteUser)
  const updateMemberRole = useServerStore((state) => state.updateMemberRole)
  const roles = useServerStore((state) => state.roles)
  const fetchRoles = useServerStore((state) => state.fetchRoles)
  const createRole = useServerStore((state) => state.createRole)
  const updateRole = useServerStore((state) => state.updateRole)
  const deleteRole = useServerStore((state) => state.deleteRole)

  // Roles tab state
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role-admin')
  const [editRoleName, setEditRoleName] = useState('Admin')
  const [editRoleColor, setEditRoleColor] = useState('#5865F2')
  const [editRoleIcon, setEditRoleIcon] = useState('')
  const [editRolePerms, setEditRolePerms] = useState<number>(1023)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [isUploadingRoleIcon, setIsUploadingRoleIcon] = useState(false)
  const roleIconInputRef = useRef<HTMLInputElement>(null)

  // Channel store
  const channels = useChannelStore((state) => state.channels)
  const setChannels = useChannelStore((state) => state.setChannels)

  // Auth store
  const token = useAuthStore((state) => state.token)
  const currentUser = useAuthStore((state) => state.user)

  // Overview form state
  const [serverName, setServerName] = useState('')
  const [description, setDescription] = useState('')
  const [slowMode, setSlowMode] = useState(0)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Members tab state
  const [membersList, setMembersList] = useState<any[]>([])
  const [memberSearch, setMemberSearch] = useState('')

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    isDanger?: boolean
    loading?: boolean
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchSettings()
      fetchBans()
      fetchMembers()
      fetchRoles()
    }
  }, [isOpen])

  // Sync role editor when selected role changes
  useEffect(() => {
    const cur = roles.find((r) => r.id === selectedRoleId)
    if (cur) {
      setEditRoleName(cur.name)
      setEditRoleColor(cur.color || '#5865F2')
      setEditRoleIcon(cur.iconUrl || '')
      setEditRolePerms(cur.permissions ?? 67)
    }
  }, [selectedRoleId, roles])

  // Sync overview fields when settings are loaded
  useEffect(() => {
    if (settings) {
      setServerName(settings.name || 'PeaceParrot Lounge')
      setDescription(settings.description || '')
      setSlowMode(settings.slowModeSeconds || 0)
      setIconPreview(settings.iconUrl || null)
    }
  }, [settings])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const fetchMembers = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/users')
      if (res.ok) {
        const data = await res.json()
        setMembersList(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to fetch members:', err)
    }
  }

  if (!isOpen) return null

  // Handle icon file selection
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setSaveError('Icon file size exceeds 10MB limit')
      return
    }

    setIconFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setIconPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Handle overview save
  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      if (iconFile) {
        const iconOk = await uploadIcon(iconFile)
        if (!iconOk) {
          setSaveError('Failed to upload server icon')
          setIsSaving(false)
          return
        }
      }

      const settingsOk = await updateSettings(serverName, description, slowMode)
      if (settingsOk) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setSaveError('Failed to save settings')
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error saving settings')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle delete channel
  const handleDeleteChannel = (channelId: string, channelName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Channel',
      message: `Are you sure you want to delete #${channelName}? This action cannot be undone.`,
      confirmText: 'Delete Channel',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:8080/api/channels/${channelId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })

          if (res.ok) {
            setChannels(channels.filter((c) => c.id !== channelId))
            toast.success(`Channel #${channelName} was deleted`)
          } else {
            toast.error('Failed to delete channel')
          }
        } catch {
          toast.error('Network error deleting channel')
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
      },
    })
  }

  // Member moderation actions
  const handleRoleChange = async (userId: string, newRole: string) => {
    const ok = await updateMemberRole(userId, newRole)
    if (ok) {
      setMembersList((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      )
      toast.success(`Updated role to ${newRole}`)
    } else {
      toast.error('Failed to update member role')
    }
  }

  const handleKick = (userId: string, username: string) => {
    setConfirmDialog({
      isOpen: true,
      title: `Kick ${username}`,
      message: `Are you sure you want to kick ${username} from the server? They will be able to rejoin with an invite.`,
      confirmText: 'Kick Member',
      isDanger: true,
      onConfirm: async () => {
        const ok = await kickUser(userId)
        if (ok) {
          toast.success(`Kicked ${username}`)
          fetchMembers()
        } else {
          toast.error(`Failed to kick ${username}`)
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
      },
    })
  }

  const handleBan = (userId: string, username: string) => {
    setConfirmDialog({
      isOpen: true,
      title: `Ban ${username}`,
      message: `Are you sure you want to ban ${username} permanently from the server? They will not be able to rejoin until unbanned.`,
      confirmText: 'Ban Member',
      isDanger: true,
      onConfirm: async () => {
        const ok = await banUser(userId)
        if (ok) {
          toast.success(`Banned ${username}`)
          fetchMembers()
          fetchBans()
        } else {
          toast.error(`Failed to ban ${username}`)
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
      },
    })
  }

  const handleUnban = async (userId: string, username: string) => {
    const ok = await unbanUser(userId)
    if (ok) {
      toast.success(`Unbanned ${username}`)
      fetchBans()
    } else {
      toast.error(`Failed to unban ${username}`)
    }
  }

  const handleMute = async (userId: string, username: string) => {
    const minutes = prompt(`Enter mute duration in minutes for ${username} (or 0 for permanent):`, '60')
    if (minutes === null) return
    const duration = parseInt(minutes, 10)
    const ok = await muteUser(userId, isNaN(duration) ? 60 : duration)
    if (ok) {
      toast.success(`Muted ${username}`)
    } else {
      toast.error(`Failed to mute ${username}`)
    }
  }

  const filteredMembers = membersList.filter((m) => {
    const q = memberSearch.toLowerCase()
    const uName = (m.username || '').toLowerCase()
    const dName = (m.displayName || '').toLowerCase()
    return uName.includes(q) || dName.includes(q)
  })

  // Role management actions
  const handleCreateRole = async () => {
    setIsCreatingRole(true)
    const newRole = await createRole('new role', '#5865F2', '✨', 67)
    setIsCreatingRole(false)
    if (newRole) {
      setSelectedRoleId(newRole.id)
      toast.success('Created new role!')
    } else {
      toast.error('Failed to create role')
    }
  }

  const handleSaveRole = async () => {
    const ok = await updateRole(selectedRoleId, editRoleName, editRoleColor, editRoleIcon, editRolePerms)
    if (ok) {
      toast.success(`Saved ${editRoleName} role settings!`)
    } else {
      toast.error('Failed to save role')
    }
  }

  const handleRoleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingRoleIcon(true)
    const uploadedUrl = await useServerStore.getState().uploadRoleIcon(selectedRoleId, file)
    setIsUploadingRoleIcon(false)
    if (uploadedUrl) {
      setEditRoleIcon(uploadedUrl)
      toast.success('Uploaded custom role photo icon!')
    } else {
      toast.error('Failed to upload role icon photo')
    }
  }

  const handleDeleteRole = (roleId: string, roleName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Role',
      message: `Are you sure you want to delete role "${roleName}"? Members with this role will lose its permissions.`,
      confirmText: 'Delete Role',
      isDanger: true,
      onConfirm: async () => {
        const ok = await deleteRole(roleId)
        if (ok) {
          setSelectedRoleId('role-admin')
          toast.success(`Deleted role ${roleName}`)
        } else {
          toast.error('Failed to delete role')
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
      },
    })
  }

  const ROLE_EMOJIS = ['👑', '🛡️', '⭐', '🔥', '💎', '🚀', '⚡', '🎮', '🎧', '🤖', '🦜', '✨', '🏆', '🎯']

  const COLOR_PALETTE = [
    '#5865F2',
    '#57F287',
    '#FEE75C',
    '#EB459E',
    '#ED4245',
    '#00AFF4',
    '#E67E22',
    '#9B59B6',
    '#1ABC9C',
    '#34495E',
  ]

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0]

  return (
    <>
      <div className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-md animate-fade-in">
        {/* Left Settings Navigation Sidebar */}
        <div
          className="w-60 shrink-0 flex flex-col py-8 px-5"
          style={{ background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border-default)' }}
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4 px-2">
            {settings?.name || 'Server Settings'}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[var(--color-brand)] text-white shadow-md'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Settings size={18} />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('channels')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'channels'
                  ? 'bg-[var(--color-brand)] text-white shadow-md'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Hash size={18} />
              <span>Channels</span>
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-[var(--color-brand)] text-white shadow-md'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Shield size={18} />
              <span>Roles & Permissions</span>
            </button>
          </div>

          <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mt-8 mb-4 px-2">
            User Management
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('members')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-[var(--color-brand)] text-white shadow-md'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Users size={18} />
              <span>Members</span>
            </button>

            <button
              onClick={() => setActiveTab('bans')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'bans'
                  ? 'bg-[var(--color-brand)] text-white shadow-md'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Ban size={18} />
              <span>Bans ({bans.length})</span>
            </button>
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
          {/* Top Bar with ESC close button */}
          <div className="h-16 px-8 flex items-center justify-between shrink-0 border-b border-[var(--color-border-default)]">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)] capitalize">
              {activeTab === 'overview' && 'Server Overview'}
              {activeTab === 'channels' && 'Channel Management'}
              {activeTab === 'roles' && 'Roles & Permissions'}
              {activeTab === 'members' && 'Member Moderation'}
              {activeTab === 'bans' && 'Banned Users'}
            </h1>

            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer text-xs font-semibold"
            >
              <X size={16} />
              <span>ESC</span>
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl">
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <form onSubmit={handleSaveOverview} className="space-y-6">
                {saveError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle size={18} />
                    <span>{saveError}</span>
                  </div>
                )}
                {saveSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                    <Check size={18} />
                    <span>Server settings updated successfully!</span>
                  </div>
                )}

                {/* Server Icon & Name Row */}
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div
                      className="w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-bold text-white shadow-xl overflow-hidden cursor-pointer"
                      style={{
                        background: iconPreview ? 'transparent' : 'var(--color-brand)',
                        border: '2px dashed var(--color-border-default)',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {iconPreview ? (
                        <img src={iconPreview} alt="Server Icon" className="w-full h-full object-cover" />
                      ) : (
                        serverName.substring(0, 2).toUpperCase() || 'PP'
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-brand)] hover:text-white transition-all shadow-md"
                    >
                      <Upload size={14} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/gif"
                      className="hidden"
                      onChange={handleIconChange}
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                      Server Name
                    </label>
                    <input
                      type="text"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      maxLength={50}
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] focus:outline-none focus:border-[var(--color-brand)] font-semibold text-base"
                    />
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                      Minimum 100x100 PNG, JPG, or GIF icon recommended. Max size 10MB.
                    </p>
                  </div>
                </div>

                {/* Server Description */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                    Server Description / Topic
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Tell your members what this server is about..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                  />
                </div>

                {/* Slow Mode */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                    Default Slow Mode
                  </label>
                  <select
                    value={slowMode}
                    onChange={(e) => setSlowMode(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                  >
                    <option value={0}>Off (No rate limit)</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-[var(--color-border-default)] flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-[var(--color-brand)] hover:opacity-90 text-white font-semibold shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* 2. CHANNELS TAB */}
            {activeTab === 'channels' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Manage channels and voice rooms in this server.
                  </p>
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-md cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Create Channel</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {channels.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base text-[var(--color-text-muted)]">
                          {ch.type === 'text' ? '#' : '🔊'}
                        </span>
                        <div>
                          <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                            {ch.name}
                          </div>
                          {ch.topic && (
                            <div className="text-xs text-[var(--color-text-muted)] truncate max-w-md">
                              {ch.topic}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteChannel(ch.id, ch.name)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete Channel"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. ROLES & PERMISSIONS TAB */}
            {activeTab === 'roles' && (
              <div className="flex gap-6 min-h-[450px]">
                {/* Role List Sidebar */}
                <div className="w-56 shrink-0 flex flex-col gap-2 p-3 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                  <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Roles</span>
                    <button
                      onClick={handleCreateRole}
                      disabled={isCreatingRole}
                      className="flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] hover:underline cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Create</span>
                    </button>
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1">
                    {roles.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRoleId(r.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                          selectedRoleId === r.id
                            ? 'bg-[var(--color-brand)] text-white shadow-md'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: r.color || '#5865F2' }}
                          />
                          <span className="truncate">{r.name}</span>
                          <RoleBadge role={r} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role Editor Panel */}
                <div className="flex-1 p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] space-y-6">
                  {selectedRole ? (
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-default)]">
                        <div>
                          <h3 className="font-bold text-base text-[var(--color-text-primary)]">
                            Edit Role — {editRoleName}
                          </h3>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Customize role appearance and server permissions
                          </p>
                        </div>
                        {selectedRole.id !== 'role-admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(selectedRole.id, selectedRole.name)}
                            className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Role"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Role Name */}
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                          Role Name
                        </label>
                        <input
                          type="text"
                          value={editRoleName}
                          onChange={(e) => setEditRoleName(e.target.value)}
                          maxLength={32}
                          className="w-full px-4 py-2 rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] text-sm font-semibold focus:outline-none focus:border-[var(--color-brand)]"
                        />
                      </div>

                      {/* Role Color */}
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
                          Role Color
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          {COLOR_PALETTE.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditRoleColor(color)}
                              className={`w-8 h-8 rounded-xl transition-transform cursor-pointer shadow-md ${
                                editRoleColor.toLowerCase() === color.toLowerCase()
                                  ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[var(--color-bg-secondary)]'
                                  : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <input
                            type="color"
                            value={editRoleColor}
                            onChange={(e) => setEditRoleColor(e.target.value)}
                            className="w-8 h-8 rounded-xl cursor-pointer bg-transparent border-0"
                            title="Custom Hex Color"
                          />
                        </div>
                      </div>

                      {/* Role Icon / Badge Photo */}
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
                          Role Icon & Badge (Rendered next to member name in chat)
                        </label>
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Image preview or emoji preview */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] shadow-sm shrink-0 overflow-hidden"
                            title="Current Role Icon"
                          >
                            {editRoleIcon &&
                            (editRoleIcon.startsWith('http') ||
                              editRoleIcon.startsWith('data:') ||
                              editRoleIcon.startsWith('/')) ? (
                              <img src={editRoleIcon} alt="Role Icon" className="w-full h-full object-cover" />
                            ) : editRoleIcon ? (
                              <span>{editRoleIcon}</span>
                            ) : (
                              <span className="text-xs text-[var(--color-text-muted)] font-medium">None</span>
                            )}
                          </div>

                          {/* Upload Photo Button */}
                          <button
                            type="button"
                            onClick={() => roleIconInputRef.current?.click()}
                            disabled={isUploadingRoleIcon}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-text-primary)] transition-all cursor-pointer shadow-sm"
                          >
                            <Upload size={14} />
                            <span>{isUploadingRoleIcon ? 'Uploading...' : 'Upload Image Photo'}</span>
                          </button>
                          <input
                            ref={roleIconInputRef}
                            type="file"
                            accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                            className="hidden"
                            onChange={handleRoleIconUpload}
                          />

                          {editRoleIcon && (
                            <button
                              type="button"
                              onClick={() => setEditRoleIcon('')}
                              className="text-xs font-semibold text-red-400 hover:underline cursor-pointer"
                            >
                              Remove Icon
                            </button>
                          )}
                        </div>

                        {/* Quick Emoji Swatches */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-[var(--color-text-muted)] mr-1">Or pick emoji:</span>
                          {ROLE_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setEditRoleIcon(emoji)}
                              className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center bg-[var(--color-bg-tertiary)] hover:scale-110 transition-transform cursor-pointer border ${
                                editRoleIcon === emoji ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/20' : 'border-transparent'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Permissions Checklist */}
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
                          Permissions
                        </label>
                        <div className="space-y-2">
                          {[
                            { id: 1, label: 'Administrator', desc: 'Grants all permissions and bypasses all restrictions' },
                            { id: 2, label: 'Manage Server', desc: 'Change server name, icon, and default settings' },
                            { id: 4, label: 'Manage Channels', desc: 'Create, edit topics, and delete channels' },
                            { id: 8, label: 'Kick Members', desc: 'Remove members from the server' },
                            { id: 16, label: 'Ban Members', desc: 'Permanently ban members from the server' },
                            { id: 32, label: 'Mute Members', desc: 'Silence members in voice and text channels' },
                            { id: 64, label: 'Send Messages', desc: 'Post messages and media in text channels' },
                            { id: 128, label: 'Connect Voice', desc: 'Join and speak in voice channels' },
                          ].map((perm) => {
                            const isChecked = (editRolePerms & perm.id) === perm.id
                            return (
                              <label
                                key={perm.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors"
                              >
                                <div>
                                  <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                                    {perm.label}
                                  </div>
                                  <div className="text-[11px] text-[var(--color-text-muted)]">{perm.desc}</div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditRolePerms((prev) => prev | perm.id)
                                    } else {
                                      setEditRolePerms((prev) => prev & ~perm.id)
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-[var(--color-brand)] cursor-pointer"
                                />
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      {/* Save Role Button */}
                      <div className="flex justify-end pt-3 border-t border-[var(--color-border-default)]">
                        <button
                          type="button"
                          onClick={handleSaveRole}
                          className="px-5 py-2 rounded-xl bg-[var(--color-brand)] hover:opacity-90 text-white text-xs font-semibold shadow-md cursor-pointer transition-all"
                        >
                          Save Role
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-[var(--color-text-muted)]">
                      Select a role to edit
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. MEMBERS TAB */}
            {activeTab === 'members' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-3 text-[var(--color-text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                    />
                  </div>
                  <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {filteredMembers.length} Members
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredMembers.map((m) => {
                    const isSelf = m.id === currentUser?.id
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.username} className="w-full h-full object-cover" />
                            ) : (
                              m.username.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-[var(--color-text-primary)] flex items-center gap-1.5">
                              <span>{m.displayName || m.username}</span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-brand)]/20 text-[var(--color-brand)] font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">@{m.username}</div>
                          </div>
                        </div>

                        {/* Roles and Actions */}
                        <div className="flex items-center gap-3">
                          <select
                            value={m.role || 'Member'}
                            disabled={isSelf}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                            className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] text-xs font-medium focus:outline-none focus:border-[var(--color-brand)]"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>

                          {!isSelf && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMute(m.id, m.username)}
                                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Mute User"
                              >
                                <MicOff size={16} />
                              </button>
                              <button
                                onClick={() => handleKick(m.id, m.username)}
                                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                                title="Kick User"
                              >
                                <UserX size={16} />
                              </button>
                              <button
                                onClick={() => handleBan(m.id, m.username)}
                                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Ban User"
                              >
                                <Ban size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 5. BANS TAB */}
            {activeTab === 'bans' && (
              <div className="space-y-6">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Banned users cannot rejoin or access this server unless unbanned.
                </p>

                {bans.length === 0 ? (
                  <div className="text-center py-12 text-[var(--color-text-muted)]">
                    <Shield size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-sm">No banned users</p>
                    <p className="text-xs mt-1">Peace reigns in PeaceParrot!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bans.map((ban) => (
                      <div
                        key={ban.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                            {ban.avatarUrl ? (
                              <img src={ban.avatarUrl} alt={ban.username} className="w-full h-full object-cover" />
                            ) : (
                              ban.username.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                              @{ban.username}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              Banned by {ban.bannedBy} on {new Date(ban.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnban(ban.userId, ban.username)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Revoke Ban
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Channel Sub-Modal */}
      <CreateChannelModal
        isOpen={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
      />

      {/* Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDanger={confirmDialog.isDanger}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  )
}

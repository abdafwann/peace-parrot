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
  Volume2,
  GripVertical,
  ArrowUp,
  ArrowDown,
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
  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null)
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null)

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
  const [editRoleColor, setEditRoleColor] = useState('#10B981')
  const [editRoleIcon, setEditRoleIcon] = useState('')
  const [editRolePerms, setEditRolePerms] = useState<number>(1023)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [isUploadingRoleIcon, setIsUploadingRoleIcon] = useState(false)
  const roleIconInputRef = useRef<HTMLInputElement>(null)

  // Channel store
  const channels = useChannelStore((state) => state.channels)
  const setChannels = useChannelStore((state) => state.setChannels)
  const reorderChannels = useChannelStore((state) => state.reorderChannels)

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
      setEditRoleColor(cur.color || '#10B981')
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
    const newRole = await createRole('new role', '#10B981', '✨', 67)
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
    '#10B981',
    '#06B6D4',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#F43F5E',
    '#F59E0B',
    '#84CC16',
    '#64748B',
  ]

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0]

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-2xl animate-fade-in">
        <div className="w-full max-w-5xl h-[88vh] flex flex-col md:flex-row rounded-3xl overflow-hidden bg-[#0c1017]/95 border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative">
          
          {/* Ambient Top Glow */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />

          {/* Left Settings Navigation Sidebar */}
          <div className="w-full md:w-64 shrink-0 p-5 md:p-6 flex flex-col justify-between bg-[#080c13]/90 border-b md:border-b-0 md:border-r border-white/10">
            <div className="space-y-6">
              <div className="px-2 pb-3 border-b border-white/5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
                  Server Administration
                </div>
                <div className="text-sm font-extrabold text-slate-100 truncate">
                  {settings?.name || 'PeaceParrot Hub'}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-2">
                  General
                </p>
                <div className="space-y-1.5">
                  <NavTabButton
                    active={activeTab === 'overview'}
                    onClick={() => setActiveTab('overview')}
                    icon={<Settings size={16} />}
                    label="Server Overview"
                  />
                  <NavTabButton
                    active={activeTab === 'channels'}
                    onClick={() => setActiveTab('channels')}
                    icon={<Hash size={16} />}
                    label="Channels"
                  />
                  <NavTabButton
                    active={activeTab === 'roles'}
                    onClick={() => setActiveTab('roles')}
                    icon={<Shield size={16} />}
                    label="Roles & Permissions"
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-2">
                  User Moderation
                </p>
                <div className="space-y-1.5">
                  <NavTabButton
                    active={activeTab === 'members'}
                    onClick={() => setActiveTab('members')}
                    icon={<Users size={16} />}
                    label="Members Directory"
                  />
                  <NavTabButton
                    active={activeTab === 'bans'}
                    onClick={() => setActiveTab('bans')}
                    icon={<Ban size={16} />}
                    label={`Bans (${bans.length})`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0c1017]/70 overflow-hidden">
            {/* Top Bar with ESC close button */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-8 py-4 bg-[#0c1017]/90 backdrop-blur-xl border-b border-white/10">
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-100 flex items-center gap-2.5">
                  {activeTab === 'overview' && (
                    <>
                      <Settings size={20} className="text-emerald-400" />
                      <span>Server Overview & Settings</span>
                    </>
                  )}
                  {activeTab === 'channels' && (
                    <>
                      <Hash size={20} className="text-emerald-400" />
                      <span>Channel Management</span>
                    </>
                  )}
                  {activeTab === 'roles' && (
                    <>
                      <Shield size={20} className="text-emerald-400" />
                      <span>Roles & Access Control</span>
                    </>
                  )}
                  {activeTab === 'members' && (
                    <>
                      <Users size={20} className="text-emerald-400" />
                      <span>Member Moderation & Roles</span>
                    </>
                  )}
                  {activeTab === 'bans' && (
                    <>
                      <Ban size={20} className="text-emerald-400" />
                      <span>Banned Users</span>
                    </>
                  )}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeTab === 'overview' && 'Configure server branding, topic descriptions, and slow-mode limits'}
                  {activeTab === 'channels' && 'Create, reorder, or delete voice and text chat rooms'}
                  {activeTab === 'roles' && 'Assign custom badges, colors, and moderation rights to community roles'}
                  {activeTab === 'members' && 'Manage member permissions, muting, and server access'}
                  {activeTab === 'bans' && 'Inspect and manage banned accounts for this community'}
                </p>
              </div>

              <button
                onClick={onClose}
                className="flex flex-col items-center group cursor-pointer"
                title="Close Settings (ESC)"
              >
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                  <X size={16} />
                </div>
                <span className="text-[9px] font-bold text-slate-500 mt-1">ESC</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {/* 1. OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <form onSubmit={handleSaveOverview} className="max-w-2xl space-y-6">
                  {saveError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle size={16} />
                      <span>{saveError}</span>
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                      <Check size={16} />
                      <span>Server settings updated successfully!</span>
                    </div>
                  )}

                  {/* Server Icon & Name Row */}
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group shrink-0">
                      <div
                        className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-2xl overflow-hidden cursor-pointer border border-white/10 bg-gradient-to-br from-emerald-600 to-teal-800 transition-transform group-hover:scale-105"
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
                        className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-[#090d14] border border-white/20 text-slate-300 hover:text-white hover:bg-emerald-600 transition-all shadow-lg cursor-pointer"
                        title="Upload New Icon"
                      >
                        <Upload size={13} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp, image/gif"
                        className="hidden"
                        onChange={handleIconChange}
                      />
                    </div>

                    <div className="flex-1 w-full space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                        Server Community Name
                      </label>
                      <input
                        type="text"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        maxLength={50}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-black/40 text-slate-100 border border-white/10 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm transition-all"
                      />
                      <p className="text-[11px] text-slate-400">
                        Recommended 256x256 PNG, JPG, or GIF icon. Max file size: 10MB.
                      </p>
                    </div>
                  </div>

                  {/* Server Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      Server Description & Topic
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      maxLength={300}
                      placeholder="Welcome members and describe what this server is about..."
                      className="w-full px-4 py-3 rounded-xl bg-black/40 text-slate-100 border border-white/10 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-all resize-none"
                    />
                  </div>

                  {/* Slow Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      Default Channel Slow Mode (Rate Limit)
                    </label>
                    <select
                      value={slowMode}
                      onChange={(e) => setSlowMode(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#080c14] text-slate-100 border border-white/10 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 text-sm cursor-pointer"
                    >
                      <option value={0}>Disabled (No rate limit)</option>
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
                  <div className="pt-4 border-t border-white/10 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? 'Saving Changes...' : 'Save Server Settings'}
                    </button>
                  </div>
                </form>
              )}

              {/* 2. CHANNELS TAB */}
              {activeTab === 'channels' && (
                <div className="max-w-3xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">Active Server Channels</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Drag channels or use arrows to adjust channel order
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreateChannel(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Create Channel</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {channels.map((ch, idx) => {
                      const isDragging = draggedChannelId === ch.id
                      const isDragOver = dragOverChannelId === ch.id
                      const isFirst = idx === 0
                      const isLast = idx === channels.length - 1

                      const handleDragStart = (e: React.DragEvent) => {
                        setDraggedChannelId(ch.id)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', ch.id)
                      }

                      const handleDragOver = (e: React.DragEvent) => {
                        if (!draggedChannelId || draggedChannelId === ch.id) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverChannelId !== ch.id) {
                          setDragOverChannelId(ch.id)
                        }
                      }

                      const handleDrop = async (e: React.DragEvent) => {
                        e.preventDefault()
                        if (!draggedChannelId || draggedChannelId === ch.id) {
                          setDraggedChannelId(null)
                          setDragOverChannelId(null)
                          return
                        }

                        const list = [...channels]
                        const fromIdx = list.findIndex((c) => c.id === draggedChannelId)
                        const toIdx = list.findIndex((c) => c.id === ch.id)

                        if (fromIdx !== -1 && toIdx !== -1) {
                          const [moved] = list.splice(fromIdx, 1)
                          list.splice(toIdx, 0, moved)
                          await reorderChannels(list, token || undefined)
                          toast.success('Channel order updated')
                        }

                        setDraggedChannelId(null)
                        setDragOverChannelId(null)
                      }

                      const handleMove = async (direction: 'up' | 'down') => {
                        const list = [...channels]
                        const index = list.findIndex((c) => c.id === ch.id)
                        if (index === -1) return
                        const newIndex = direction === 'up' ? index - 1 : index + 1
                        if (newIndex < 0 || newIndex >= list.length) return

                        const [moved] = list.splice(index, 1)
                        list.splice(newIndex, 0, moved)
                        await reorderChannels(list, token || undefined)
                        toast.success('Channel order updated')
                      }

                      return (
                        <div
                          key={ch.id}
                          draggable
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDragEnd={() => {
                            setDraggedChannelId(null)
                            setDragOverChannelId(null)
                          }}
                          onDrop={handleDrop}
                          className={`flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all ${
                            isDragging ? 'opacity-30 scale-98' : ''
                          } ${
                            isDragOver ? 'ring-2 ring-emerald-400 bg-emerald-500/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span
                              className="text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                              title="Drag to reorder"
                            >
                              <GripVertical size={16} />
                            </span>
                            <div className="w-9 h-9 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-slate-400 font-bold shrink-0">
                              {ch.type === 'text' ? '#' : <Volume2 size={16} className="text-emerald-400" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                                <span>{ch.name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-mono uppercase">
                                  {ch.type}
                                </span>
                              </div>
                              {ch.topic && (
                                <div className="text-xs text-slate-400 truncate max-w-lg mt-0.5">
                                  {ch.topic}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={() => handleMove('up')}
                              className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-white/5 disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={() => handleMove('down')}
                              className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-white/5 disabled:opacity-20 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteChannel(ch.id, ch.name)}
                              className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
                              title="Delete Channel"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 3. ROLES & PERMISSIONS TAB */}
              {activeTab === 'roles' && (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[480px]">
                  {/* Role List Sidebar */}
                  <div className="w-full lg:w-60 shrink-0 flex flex-col gap-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between px-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Roles List</span>
                      <button
                        onClick={handleCreateRole}
                        disabled={isCreatingRole}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Create</span>
                      </button>
                    </div>

                    <div className="space-y-1 overflow-y-auto flex-1 max-h-[350px] lg:max-h-none">
                      {roles.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRoleId(r.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                            selectedRoleId === r.id
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-md'
                              : 'text-slate-300 hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: r.color || '#10B981' }}
                            />
                            <span className="truncate">{r.name}</span>
                            <RoleBadge role={r} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Role Editor Panel */}
                  <div className="flex-1 p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
                    {selectedRole ? (
                      <>
                        <div className="flex items-center justify-between pb-4 border-b border-white/10">
                          <div>
                            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                              <span>Edit Role:</span>
                              <span style={{ color: editRoleColor }}>{editRoleName}</span>
                            </h3>
                            <p className="text-xs text-slate-400">
                              Customize badge flair, colors, and server permissions
                            </p>
                          </div>
                          {selectedRole.id !== 'role-admin' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(selectedRole.id, selectedRole.name)}
                              className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Role"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {/* Role Name */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                            Role Name
                          </label>
                          <input
                            type="text"
                            value={editRoleName}
                            onChange={(e) => setEditRoleName(e.target.value)}
                            maxLength={32}
                            className="w-full px-4 py-2.5 rounded-xl bg-black/40 text-slate-100 border border-white/10 text-sm font-semibold focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        {/* Role Color */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                            Role Color
                          </label>
                          <div className="flex flex-wrap items-center gap-2.5">
                            {COLOR_PALETTE.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setEditRoleColor(color)}
                                className={`w-8 h-8 rounded-xl transition-all cursor-pointer shadow-md border ${
                                  editRoleColor.toLowerCase() === color.toLowerCase()
                                    ? 'scale-110 border-white ring-2 ring-emerald-400'
                                    : 'border-white/10 hover:scale-105'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <input
                              type="color"
                              value={editRoleColor}
                              onChange={(e) => setEditRoleColor(e.target.value)}
                              className="w-8 h-8 rounded-xl cursor-pointer bg-transparent border-0"
                              title="Custom Color"
                            />
                          </div>
                        </div>

                        {/* Role Icon / Badge Photo */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                            Role Icon & Badge
                          </label>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-black/40 border border-white/10 shadow-sm shrink-0 overflow-hidden"
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
                                <span className="text-xs text-slate-400 font-medium">None</span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => roleIconInputRef.current?.click()}
                              disabled={isUploadingRoleIcon}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                            >
                              <Upload size={13} />
                              <span>{isUploadingRoleIcon ? 'Uploading...' : 'Upload Image'}</span>
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
                                className="text-xs font-semibold text-rose-400 hover:underline cursor-pointer"
                              >
                                Remove Icon
                              </button>
                            )}
                          </div>

                          {/* Quick Emoji Swatches */}
                          <div className="pt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 mr-1">Or choose emoji:</span>
                            {ROLE_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setEditRoleIcon(emoji)}
                                className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center bg-white/5 hover:scale-110 transition-transform cursor-pointer border ${
                                  editRoleIcon === emoji ? 'border-emerald-500 bg-emerald-500/20' : 'border-transparent'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Permissions Checklist */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                            Permissions Matrix
                          </label>
                          <div className="space-y-2">
                            {[
                              { id: 1, label: 'Administrator', desc: 'Grants all permissions and bypasses server limits' },
                              { id: 2, label: 'Manage Server', desc: 'Change server branding, icon, and rate limits' },
                              { id: 4, label: 'Manage Channels', desc: 'Create, reorder, edit topics, and delete channels' },
                              { id: 8, label: 'Kick Members', desc: 'Remove disruptive users from the community' },
                              { id: 16, label: 'Ban Members', desc: 'Permanently blacklist malicious users' },
                              { id: 32, label: 'Mute Members', desc: 'Temporarily silence members in voice and text' },
                              { id: 64, label: 'Send Messages', desc: 'Post text messages and attachments in channels' },
                              { id: 128, label: 'Connect Voice', desc: 'Join voice channels and transmit microphone audio' },
                            ].map((perm) => {
                              const isChecked = (editRolePerms & perm.id) === perm.id
                              return (
                                <label
                                  key={perm.id}
                                  className="flex items-center justify-between p-3.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 cursor-pointer transition-colors"
                                >
                                  <div>
                                    <div className="text-xs font-bold text-slate-200">
                                      {perm.label}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">{perm.desc}</div>
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
                                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                  />
                                </label>
                              )
                            })}
                          </div>
                        </div>

                        {/* Save Role Button */}
                        <div className="flex justify-end pt-3 border-t border-white/10">
                          <button
                            type="button"
                            onClick={handleSaveRole}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer transition-all"
                          >
                            Save Role Changes
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        Select a role to configure
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. MEMBERS TAB */}
              {activeTab === 'members' && (
                <div className="max-w-3xl space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter members by name..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 text-slate-100 border border-white/10 text-xs focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div className="text-xs font-bold text-slate-400">
                      {filteredMembers.length} Members
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredMembers.map((m) => {
                      const isSelf = m.id === currentUser?.id
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/15 transition-all"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-sm overflow-hidden shrink-0 shadow-sm">
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt={m.username} className="w-full h-full object-cover" />
                              ) : (
                                m.username.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-100 flex items-center gap-2 truncate">
                                <span>{m.displayName || m.username}</span>
                                {isSelf && (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold tracking-wider">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">@{m.username}</div>
                            </div>
                          </div>

                          {/* Roles and Actions */}
                          <div className="flex items-center gap-3 shrink-0">
                            <select
                              value={m.role || 'Member'}
                              disabled={isSelf}
                              onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                              className="px-3 py-1.5 rounded-xl bg-[#080c14] text-slate-200 border border-white/10 text-xs font-semibold focus:outline-none focus:border-emerald-500/60 cursor-pointer disabled:opacity-50"
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
                                  className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                  title="Mute Member"
                                >
                                  <MicOff size={15} />
                                </button>
                                <button
                                  onClick={() => handleKick(m.id, m.username)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors cursor-pointer"
                                  title="Kick Member"
                                >
                                  <UserX size={15} />
                                </button>
                                <button
                                  onClick={() => handleBan(m.id, m.username)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Ban Member"
                                >
                                  <Ban size={15} />
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
                <div className="max-w-3xl space-y-6">
                  <p className="text-xs text-slate-400">
                    Banned user accounts are restricted from joining channels or accessing messages.
                  </p>

                  {bans.length === 0 ? (
                    <div className="text-center py-16 p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-slate-400">
                      <Shield size={40} className="mx-auto mb-3 text-emerald-400 opacity-40" />
                      <p className="font-bold text-sm text-slate-300">No Banned Users</p>
                      <p className="text-xs text-slate-400 mt-1">Peace reigns in PeaceParrot!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bans.map((ban) => (
                        <div
                          key={ban.id}
                          className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                              {ban.avatarUrl ? (
                                <img src={ban.avatarUrl} alt={ban.username} className="w-full h-full object-cover" />
                              ) : (
                                ban.username.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-100">
                                @{ban.username}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Banned by {ban.bannedBy} on {new Date(ban.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleUnban(ban.userId, ban.username)}
                            className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
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

function NavTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
        active
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

import { useState, useEffect, useRef } from 'react'
import {
  X,
  User as UserIcon,
  Mic,
  Palette,
  Bell,
  LogOut,
  Check,
  Moon,
  Sun,
  Keyboard,
  RotateCcw,
  Sparkles,
  Speaker,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  playSoundEffect,
  requestDesktopNotificationPermission,
} from '../utils/soundEffects'

interface UserSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'profile' | 'voice' | 'notifications' | 'appearance'

const AVATAR_GRADIENT_PRESETS = [
  { id: 'parrot-blue', name: 'Parrot Indigo', bg: 'linear-gradient(135deg, #5865f2, #00b0f4)' },
  { id: 'emerald', name: 'Emerald Forest', bg: 'linear-gradient(135deg, #23a559, #059669)' },
  { id: 'sunset', name: 'Golden Sunset', bg: 'linear-gradient(135deg, #f0b232, #ea580c)' },
  { id: 'neon-rose', name: 'Neon Rose', bg: 'linear-gradient(135deg, #ed4245, #db2777)' },
  { id: 'cyberpunk', name: 'Cyber Violet', bg: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
  { id: 'deep-ocean', name: 'Deep Ocean', bg: 'linear-gradient(135deg, #0284c7, #1e3a8a)' },
]

const BANNER_GRADIENT_PRESETS = [
  { id: 'cyber-violet', name: 'Cyber Violet', bg: 'linear-gradient(135deg, #4f46e5, #06b6d4)' },
  { id: 'sunset-blaze', name: 'Sunset Blaze', bg: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { id: 'emerald-aurora', name: 'Emerald Aurora', bg: 'linear-gradient(135deg, #10b981, #3b82f6)' },
  { id: 'midnight-neon', name: 'Midnight Neon', bg: 'linear-gradient(135deg, #18181b, #8b5cf6)' },
  { id: 'crimson-dark', name: 'Crimson Dark', bg: 'linear-gradient(135deg, #991b1b, #1e1b4b)' },
  { id: 'deep-abyss', name: 'Deep Abyss', bg: 'linear-gradient(135deg, #09090b, #0284c7)' },
]

export function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const { theme, toggleTheme } = useThemeStore()

  const settings = useSettingsStore()
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const resetToDefaults = useSettingsStore((state) => state.resetToDefaults)

  const [activeTab, setActiveTab] = useState<TabType>('profile')

  // Profile form states
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [bannerUrl, setBannerUrl] = useState(user?.bannerUrl || '')
  const [selectedGradient, setSelectedGradient] = useState<string>(AVATAR_GRADIENT_PRESETS[0].bg)
  const [selectedBannerGradient, setSelectedBannerGradient] = useState<string>(BANNER_GRADIENT_PRESETS[0].bg)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')

  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)

  // Media Devices
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([])

  // PTT key recording state
  const [isRecordingPTT, setIsRecordingPTT] = useState(false)

  // Notifications permission state
  const [notificationPerm, setNotificationPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  // Mic test state
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [micVolume, setMicVolume] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Sync user state
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || '')
      setBio(user.bio || '')
      setAvatarUrl(user.avatarUrl || '')
      setBannerUrl(user.bannerUrl || '')
    }
  }, [user])

  // Fetch media devices
  useEffect(() => {
    if (!isOpen) return

    const loadDevices = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return
        const devices = await navigator.mediaDevices.enumerateDevices()
        const inputs = devices.filter((d) => d.kind === 'audioinput')
        const outputs = devices.filter((d) => d.kind === 'audiooutput')

        setAudioInputDevices(inputs)
        setAudioOutputDevices(outputs)

        // Set default device if none selected
        if (!settings.inputDeviceId && inputs.length > 0) {
          updateSettings({ inputDeviceId: inputs[0].deviceId })
        }
        if (!settings.outputDeviceId && outputs.length > 0) {
          updateSettings({ outputDeviceId: outputs[0].deviceId })
        }
      } catch (err) {
        console.warn('Could not enumerate audio devices:', err)
      }
    }

    loadDevices()
  }, [isOpen, settings.inputDeviceId, settings.outputDeviceId, updateSettings])

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRecordingPTT) {
        e.preventDefault()
        e.stopPropagation()
        const key = e.code || e.key
        updateSettings({ pttKey: key })
        setIsRecordingPTT(false)
        return
      }

      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, isRecordingPTT, updateSettings])

  // Mic testing logic
  useEffect(() => {
    if (isTestingMic) {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        },
      }

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          micStreamRef.current = stream
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
          audioContextRef.current = audioCtx
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          const source = audioCtx.createMediaStreamSource(stream)
          source.connect(analyser)

          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          const checkVolume = () => {
            analyser.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            const average = sum / dataArray.length
            // Apply input volume gain
            const scaled = (average / 128) * (settings.inputVolume / 100) * 100
            setMicVolume(Math.min(100, Math.round(scaled)))
            animFrameRef.current = requestAnimationFrame(checkVolume)
          }

          checkVolume()
        })
        .catch((err) => {
          console.error('Failed to get mic stream:', err)
          setIsTestingMic(false)
        })
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      setMicVolume(0)
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [isTestingMic, settings.inputDeviceId, settings.echoCancellation, settings.noiseSuppression, settings.autoGainControl, settings.inputVolume])

  if (!isOpen) return null

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setError('Avatar image must be smaller than 10 MB')
      return
    }

    setIsUploadingAvatar(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('http://localhost:8080/api/users/me/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message || 'Failed to upload avatar')
        return
      }

      setAvatarUrl(data.avatarUrl)
      setUser(data)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Network error uploading avatar')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = ''
    }
  }

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setError('Banner file must be smaller than 10 MB')
      return
    }

    setIsUploadingBanner(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('http://localhost:8080/api/users/me/banner', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message || 'Failed to upload banner')
        return
      }

      setBannerUrl(data.bannerUrl)
      setUser(data)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Network error uploading banner')
    } finally {
      setIsUploadingBanner(false)
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = ''
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    setSaveSuccess(false)

    try {
      const res = await fetch('http://localhost:8080/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
          bannerUrl: bannerUrl.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Failed to save profile')
        return
      }

      setUser(data)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Network error saving profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRequestNotifications = async () => {
    const granted = await requestDesktopNotificationPermission()
    if (typeof Notification !== 'undefined') {
      setNotificationPerm(Notification.permission)
    }
    updateSettings({ desktopNotifications: granted })
  }

  const handleLogout = () => {
    logout()
    onClose()
    window.location.reload()
  }

  const initials = (displayName || user?.username || 'U')[0].toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in bg-black/75 backdrop-blur-md">
      <div className="w-full h-full flex max-w-5xl mx-auto my-auto max-h-[88vh] rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
        {/* Left Sidebar Navigation */}
        <div
          className="w-64 shrink-0 p-6 flex flex-col justify-between"
          style={{ background: 'var(--color-bg-tertiary)', borderRight: '1px solid var(--color-border-default)' }}
        >
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-3 mb-2">
                User Settings
              </p>
              <nav className="space-y-1">
                <TabButton
                  active={activeTab === 'profile'}
                  onClick={() => setActiveTab('profile')}
                  icon={<UserIcon size={17} />}
                  label="My Account & Profile"
                />
                <TabButton
                  active={activeTab === 'voice'}
                  onClick={() => setActiveTab('voice')}
                  icon={<Mic size={17} />}
                  label="Voice & Audio"
                />
                <TabButton
                  active={activeTab === 'notifications'}
                  onClick={() => setActiveTab('notifications')}
                  icon={<Bell size={17} />}
                  label="Notifications & Sounds"
                />
                <TabButton
                  active={activeTab === 'appearance'}
                  onClick={() => setActiveTab('appearance')}
                  icon={<Palette size={17} />}
                  label="Appearance"
                />
              </nav>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-[var(--color-border-default)] space-y-2">
            <button
              onClick={resetToDefaults}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Reset Preferences</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#ed4245] hover:bg-[#ed4245]/15 transition-colors text-left cursor-pointer"
            >
              <LogOut size={17} />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-primary)] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[var(--color-bg-primary)]/90 backdrop-blur-md border-b border-[var(--color-border-default)]">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                {activeTab === 'profile' && 'My Profile & Account'}
                {activeTab === 'voice' && 'Voice & Audio Settings'}
                {activeTab === 'notifications' && 'Notifications & Sound Alerts'}
                {activeTab === 'appearance' && 'Appearance & Layout'}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {activeTab === 'profile' && 'Customize your identity and presentation across channels'}
                {activeTab === 'voice' && 'Configure input devices, push-to-talk, and WebRTC audio processing'}
                {activeTab === 'notifications' && 'Manage desktop notification alerts and sound feedback'}
                {activeTab === 'appearance' && 'Personalize theme styles and chat message compactness'}
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex flex-col items-center group cursor-pointer"
              title="Close Settings (ESC)"
            >
              <div className="w-9 h-9 rounded-full border border-[var(--color-border-default)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-white group-hover:bg-[var(--color-bg-hover)] transition-all">
                <X size={18} />
              </div>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1">ESC</span>
            </button>
          </div>

          {/* Tab Body */}
          <div className="p-8 max-w-2xl space-y-8">
            {/* ========================================================================= */}
            {/* TAB 1: Profile */}
            {/* ========================================================================= */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                {/* Profile Card Preview */}
                <div
                  className="rounded-2xl p-5 relative overflow-hidden shadow-lg"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  {/* Header Banner */}
                  <div
                    className="h-28 -m-5 mb-0 rounded-t-2xl relative overflow-hidden transition-all duration-300 flex items-center justify-center"
                    style={{
                      background: bannerUrl && (bannerUrl.startsWith('http') || bannerUrl.startsWith('data:')) ? 'transparent' : (bannerUrl || selectedBannerGradient),
                    }}
                  >
                    {bannerUrl && (bannerUrl.startsWith('http') || bannerUrl.startsWith('data:')) ? (
                      <img
                        src={bannerUrl}
                        alt="Profile Banner"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    {/* Subtle bottom shadow overlay for contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  </div>

                  {/* Avatar + Quick Badges */}
                  <div className="relative -mt-12 flex items-end justify-between mb-3">
                    <div
                      className="w-22 h-22 rounded-full ring-4 ring-[var(--color-bg-secondary)] flex items-center justify-center text-2xl font-bold text-white shadow-xl overflow-hidden transition-all duration-300 relative group"
                      style={{
                        background: avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) ? 'transparent' : selectedGradient,
                      }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-[var(--color-text-primary)]">
                      {displayName || user?.username || 'Username'}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] font-mono">@{user?.username || 'username'}</p>
                    {bio && (
                      <p className="mt-3 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Profile Banner Customization */}
                <div className="p-4 rounded-xl space-y-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={14} className="text-[var(--color-brand)]" />
                        <span>Profile Banner (Static Image or Animated GIF)</span>
                      </h4>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        Upload an image or animated GIF (up to 10MB)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={bannerFileInputRef}
                        onChange={handleUploadBanner}
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => bannerFileInputRef.current?.click()}
                        disabled={isUploadingBanner}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--color-brand)] hover:brightness-110 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingBanner ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        <span>{isUploadingBanner ? 'Uploading...' : 'Upload Banner'}</span>
                      </button>

                      {bannerUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setBannerUrl('')
                            setSelectedBannerGradient(BANNER_GRADIENT_PRESETS[0].bg)
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Banner Gradient Presets */}
                  <div className="pt-2">
                    <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1.5">
                      Or Choose a Gradient Preset
                    </label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {BANNER_GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setBannerUrl(preset.bg)
                            setSelectedBannerGradient(preset.bg)
                          }}
                          title={preset.name}
                          className={`w-12 h-6 rounded-md transition-all relative ${
                            bannerUrl === preset.bg || selectedBannerGradient === preset.bg
                              ? 'scale-105 ring-2 ring-white shadow-md'
                              : 'hover:scale-105 opacity-80 hover:opacity-100'
                          }`}
                          style={{ background: preset.bg }}
                        >
                          {(bannerUrl === preset.bg || selectedBannerGradient === preset.bg) && (
                            <Check size={12} className="text-white mx-auto drop-shadow-md" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Avatar Customization */}
                <div className="p-4 rounded-xl space-y-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[var(--color-brand)]" />
                        <span>User Avatar</span>
                      </h4>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        Upload custom avatar (up to 10MB) or pick a preset gradient
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={avatarFileInputRef}
                        onChange={handleUploadAvatar}
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--color-brand)] hover:brightness-110 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        <span>{isUploadingAvatar ? 'Uploading...' : 'Upload Avatar'}</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl('')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Avatar Color Presets */}
                  <div className="pt-2">
                    <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1.5">
                      Avatar Gradient Presets
                    </label>
                    <div className="flex items-center gap-2.5">
                      {AVATAR_GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setAvatarUrl('')
                            setSelectedGradient(preset.bg)
                          }}
                          title={preset.name}
                          className={`w-8 h-8 rounded-full transition-transform duration-150 relative ${
                            !avatarUrl && selectedGradient === preset.bg ? 'scale-110 ring-2 ring-white shadow-md' : 'hover:scale-105 opacity-80 hover:opacity-100'
                          }`}
                          style={{ background: preset.bg }}
                        >
                          {!avatarUrl && selectedGradient === preset.bg && (
                            <Check size={13} className="text-white mx-auto drop-shadow-md" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {error && (
                    <div className="p-3 rounded-lg bg-[#ed4245]/15 border border-[#ed4245]/30 text-sm text-[#ed4245]">
                      {error}
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="p-3 rounded-lg bg-[#23a559]/15 border border-[#23a559]/30 text-sm text-[#23a559] flex items-center gap-2">
                      <Check size={16} />
                      <span>Profile updated successfully!</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter how you appear to others"
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      About Me / Bio
                    </label>
                    <textarea
                      rows={3}
                      maxLength={190}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell the flock a little about yourself"
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] transition-colors resize-none"
                    />
                    <p className="text-[11px] text-[var(--color-text-muted)] text-right">
                      {bio.length} / 190 characters
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-brand)] hover:brightness-110 active:scale-95 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: Voice & Audio */}
            {/* ========================================================================= */}
            {activeTab === 'voice' && (
              <div className="space-y-8">
                {/* Device Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                      <Mic size={14} className="text-[var(--color-brand)]" />
                      <span>Input Device (Microphone)</span>
                    </label>
                    <select
                      value={settings.inputDeviceId}
                      onChange={(e) => updateSettings({ inputDeviceId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                    >
                      {audioInputDevices.length > 0 ? (
                        audioInputDevices.map((d, i) => (
                          <option key={d.deviceId || i} value={d.deviceId}>
                            {d.label || `Microphone ${i + 1}`}
                          </option>
                        ))
                      ) : (
                        <option value="">Default System Microphone</option>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                      <Speaker size={14} className="text-[var(--color-brand)]" />
                      <span>Output Device (Speakers)</span>
                    </label>
                    <select
                      value={settings.outputDeviceId}
                      onChange={(e) => updateSettings({ outputDeviceId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                    >
                      {audioOutputDevices.length > 0 ? (
                        audioOutputDevices.map((d, i) => (
                          <option key={d.deviceId || i} value={d.deviceId}>
                            {d.label || `Speaker ${i + 1}`}
                          </option>
                        ))
                      ) : (
                        <option value="">Default System Output</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Input Volume & Output Volume */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl space-y-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
                      <span>Input Volume</span>
                      <span className="text-[var(--color-brand)]">{settings.inputVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.inputVolume}
                      onChange={(e) => updateSettings({ inputVolume: Number(e.target.value) })}
                      className="w-full accent-[var(--color-brand)] cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-xl space-y-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
                      <span>Output Volume</span>
                      <span className="text-[var(--color-brand)]">{settings.outputVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={settings.outputVolume}
                      onChange={(e) => updateSettings({ outputVolume: Number(e.target.value) })}
                      className="w-full accent-[var(--color-brand)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Input Mode: Voice Activity vs Push-to-Talk */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Input Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateSettings({ inputMode: 'voice_activity' })}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        settings.inputMode === 'voice_activity'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/15 ring-2 ring-[var(--color-brand)]'
                          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">Voice Activity</span>
                        {settings.inputMode === 'voice_activity' && <Check size={16} className="text-[var(--color-brand)]" />}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Transmits automatically when you speak
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSettings({ inputMode: 'push_to_talk' })}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        settings.inputMode === 'push_to_talk'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/15 ring-2 ring-[var(--color-brand)]'
                          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">Push to Talk</span>
                        {settings.inputMode === 'push_to_talk' && <Check size={16} className="text-[var(--color-brand)]" />}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Hold shortcut key to transmit audio
                      </p>
                    </button>
                  </div>

                  {/* PTT Key Recorder */}
                  {settings.inputMode === 'push_to_talk' && (
                    <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] flex items-center justify-between animate-fade-in">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">Shortcut Keybind</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Press and hold this key during calls to activate microphone
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsRecordingPTT(true)}
                        className={`px-4 py-2 rounded-lg font-mono text-sm font-bold border transition-all ${
                          isRecordingPTT
                            ? 'bg-[#ed4245] text-white border-[#ed4245] animate-pulse'
                            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-brand)] border-[var(--color-border-default)] hover:border-[var(--color-brand)]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Keyboard size={15} />
                          {isRecordingPTT ? 'Press any key...' : settings.pttKey || 'Space'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Voice Sensitivity Slider */}
                  {settings.inputMode === 'voice_activity' && (
                    <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
                        <span>Voice Sensitivity Threshold</span>
                        <span>{settings.vadSensitivity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={settings.vadSensitivity}
                        onChange={(e) => updateSettings({ vadSensitivity: Number(e.target.value) })}
                        className="w-full accent-[var(--color-parrot-green)] cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Mic Test Visualizer */}
                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand)] flex items-center justify-center shrink-0">
                        <Mic size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[var(--color-text-primary)]">Microphone Test</h4>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Check input sensitivity and volume response in real-time
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsTestingMic(!isTestingMic)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        isTestingMic
                          ? 'bg-[#ed4245] text-white hover:brightness-110'
                          : 'bg-[var(--color-brand)] text-white hover:brightness-110'
                      }`}
                    >
                      {isTestingMic ? 'Stop Test' : 'Let’s Check'}
                    </button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
                      <span>Input Level</span>
                      <span className={micVolume >= settings.vadSensitivity ? 'text-[#23a559]' : 'text-[var(--color-text-muted)]'}>
                        {micVolume}% {micVolume >= settings.vadSensitivity ? '• Transmitting' : '• Gated'}
                      </span>
                    </div>
                    {/* VU Meter with Threshold Needle */}
                    <div className="relative h-4 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden p-0.5 border border-[var(--color-border-default)]">
                      {/* Active volume bar */}
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${micVolume}%`,
                          background:
                            micVolume >= settings.vadSensitivity
                              ? 'linear-gradient(90deg, #23a559, #3ba55d)'
                              : '#4e5058',
                        }}
                      />
                      {/* Threshold Marker Indicator */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-[var(--color-brand)] z-10 shadow-sm"
                        style={{ left: `${settings.vadSensitivity}%` }}
                        title={`Threshold: ${settings.vadSensitivity}%`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>0% (Quiet)</span>
                      <span className="text-[var(--color-brand)] font-medium">Cutoff: {settings.vadSensitivity}%</span>
                      <span>100% (Loud)</span>
                    </div>
                  </div>
                </div>

                {/* WebRTC DSP Audio Processing Enhancements */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Voice Processing Enhancements
                  </h4>
                  <div className="p-4 rounded-xl space-y-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                    <SwitchItem
                      label="Echo Cancellation"
                      desc="Suppresses room reverberation and prevents speaker feedback loop"
                      checked={settings.echoCancellation}
                      onChange={(checked) => updateSettings({ echoCancellation: checked })}
                    />

                    <SwitchItem
                      label="Noise Suppression"
                      desc="Filters background keyboard clicks, computer fans, and ambient hums"
                      checked={settings.noiseSuppression}
                      onChange={(checked) => updateSettings({ noiseSuppression: checked })}
                    />

                    <SwitchItem
                      label="Automatic Gain Control"
                      desc="Dynamically normalizes quiet whisper and loud voice levels"
                      checked={settings.autoGainControl}
                      onChange={(checked) => updateSettings({ autoGainControl: checked })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: Notifications & Sounds */}
            {/* ========================================================================= */}
            {activeTab === 'notifications' && (
              <div className="space-y-8">
                {/* Desktop Notifications Permission Card */}
                <div className="p-5 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/15 text-[var(--color-brand)] flex items-center justify-center shrink-0">
                        <Bell size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[var(--color-text-primary)]">
                          Desktop System Notifications
                        </h4>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Receive banner alerts on new messages when the app window is in background
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        notificationPerm === 'granted'
                          ? 'bg-[#23a559]/20 text-[#23a559]'
                          : notificationPerm === 'denied'
                          ? 'bg-[#ed4245]/20 text-[#ed4245]'
                          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {notificationPerm === 'granted' ? 'Allowed' : notificationPerm === 'denied' ? 'Blocked' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[var(--color-border-default)]">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {notificationPerm === 'granted'
                        ? 'System notifications are active and ready.'
                        : 'Click below to grant OS notification permissions.'}
                    </span>

                    <button
                      type="button"
                      onClick={handleRequestNotifications}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[var(--color-brand)] hover:brightness-110 active:scale-95 transition-all"
                    >
                      {notificationPerm === 'granted' ? 'Re-verify Permission' : 'Enable Notifications'}
                    </button>
                  </div>
                </div>

                {/* Sound Effects Controls */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    In-App Audio Feedback & Chimes
                  </h4>
                  <div className="p-4 rounded-xl space-y-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">New Message Sound</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Plays a soft chime when a text message arrives</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playSoundEffect('message')}
                          className="px-2.5 py-1 rounded text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-white transition-colors"
                        >
                          Preview
                        </button>
                        <input
                          type="checkbox"
                          checked={settings.soundMessage}
                          onChange={(e) => updateSettings({ soundMessage: e.target.checked })}
                          className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">Voice Channel Join / Leave</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Plays a tone when users enter or exit voice channels</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playSoundEffect('join')}
                          className="px-2.5 py-1 rounded text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-white transition-colors"
                        >
                          Preview
                        </button>
                        <input
                          type="checkbox"
                          checked={settings.soundVoiceJoinLeave}
                          onChange={(e) => updateSettings({ soundVoiceJoinLeave: e.target.checked })}
                          className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">Mute & Deafen Toggles</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Plays a confirmation click when toggling microphone or headphones</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playSoundEffect('mute')}
                          className="px-2.5 py-1 rounded text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-white transition-colors"
                        >
                          Preview
                        </button>
                        <input
                          type="checkbox"
                          checked={settings.soundMuteToggle}
                          onChange={(e) => updateSettings({ soundMuteToggle: e.target.checked })}
                          className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: Appearance */}
            {/* ========================================================================= */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                {/* Theme Selection */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Theme Selection
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => theme !== 'dark' && toggleTheme()}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        theme === 'dark'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/15 ring-2 ring-[var(--color-brand)]'
                          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Moon size={20} className="text-[#f0b232]" />
                        {theme === 'dark' && <Check size={16} className="text-[var(--color-brand)]" />}
                      </div>
                      <h5 className="font-bold text-sm text-[var(--color-text-primary)]">Dark Mode</h5>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Sleek, deep charcoal interface optimized for long gaming sessions
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => theme !== 'light' && toggleTheme()}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        theme === 'light'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/15 ring-2 ring-[var(--color-brand)]'
                          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Sun size={20} className="text-[#f0b232]" />
                        {theme === 'light' && <Check size={16} className="text-[var(--color-brand)]" />}
                      </div>
                      <h5 className="font-bold text-sm text-[var(--color-text-primary)]">Light Mode</h5>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Clean and bright presentation for high ambient light readability
                      </p>
                    </button>
                  </div>
                </div>

                {/* Chat Message Layout Density */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Message Display Density
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => updateSettings({ chatDisplayMode: 'cozy' })}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        settings.chatDisplayMode === 'cozy'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/15 ring-2 ring-[var(--color-brand)]'
                          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-[var(--color-text-primary)]">Cozy Mode</span>
                        {settings.chatDisplayMode === 'cozy' && <Check size={16} className="text-[var(--color-brand)]" />}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Modern spacious design with prominent user avatars and clear separation
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSettings({ chatDisplayMode: 'compact' })}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        settings.chatDisplayMode === 'compact'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/15 ring-2 ring-[var(--color-brand)]'
                          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-[var(--color-text-primary)]">Compact Mode</span>
                        {settings.chatDisplayMode === 'compact' && <Check size={16} className="text-[var(--color-brand)]" />}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        High-density single-line layout fitting more messages on screen
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
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
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
        active
          ? 'bg-[var(--color-brand)] text-white shadow-sm'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function SwitchItem({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer"
      />
    </div>
  )
}

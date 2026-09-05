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
  Volume2,
  Upload,
  Image as ImageIcon,
  Loader2,
  Radio,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  playSoundEffect,
  requestDesktopNotificationPermission,
} from '../utils/soundEffects'
import { API_BASE_URL } from '../utils/config'

interface UserSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'profile' | 'voice' | 'notifications' | 'appearance'

const AVATAR_GRADIENT_PRESETS = [
  { id: 'parrot-emerald', name: 'Emerald Forest', bg: 'linear-gradient(135deg, #10b981, #059669)' },
  { id: 'parrot-blue', name: 'Parrot Indigo', bg: 'linear-gradient(135deg, #6366f1, #0ea5e9)' },
  { id: 'sunset', name: 'Golden Sunset', bg: 'linear-gradient(135deg, #f59e0b, #ea580c)' },
  { id: 'neon-rose', name: 'Neon Rose', bg: 'linear-gradient(135deg, #f43f5e, #db2777)' },
  { id: 'cyberpunk', name: 'Cyber Violet', bg: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
  { id: 'deep-ocean', name: 'Deep Ocean', bg: 'linear-gradient(135deg, #0284c7, #1e3a8a)' },
]

const BANNER_GRADIENT_PRESETS = [
  { id: 'emerald-aurora', name: 'Emerald Aurora', bg: 'linear-gradient(135deg, #064e3b, #047857, #10b981)' },
  { id: 'cyber-violet', name: 'Cyber Violet', bg: 'linear-gradient(135deg, #312e81, #4f46e5, #06b6d4)' },
  { id: 'sunset-blaze', name: 'Sunset Blaze', bg: 'linear-gradient(135deg, #7c2d12, #ea580c, #f59e0b)' },
  { id: 'midnight-neon', name: 'Midnight Neon', bg: 'linear-gradient(135deg, #09090b, #18181b, #8b5cf6)' },
  { id: 'crimson-dark', name: 'Crimson Dark', bg: 'linear-gradient(135deg, #450a0a, #991b1b, #1e1b4b)' },
  { id: 'deep-abyss', name: 'Deep Abyss', bg: 'linear-gradient(135deg, #030712, #075985, #0284c7)' },
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

      const res = await fetch(`${API_BASE_URL}/api/users/me/avatar`, {
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

      const res = await fetch(`${API_BASE_URL}/api/users/me/banner`, {
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
      const res = await fetch(`${API_BASE_URL}/api/users/me`, {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-2xl animate-fade-in">
      <div className="w-full max-w-5xl h-[88vh] flex flex-col md:flex-row rounded-3xl overflow-hidden bg-[#0c1017]/95 border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />

        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 p-5 md:p-6 flex flex-col justify-between bg-[#080c13]/90 border-b md:border-b-0 md:border-r border-white/10">
          <div className="space-y-6">
            {/* Header User Badge */}
            <div className="flex items-center gap-3 px-2 pb-3 border-b border-white/5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md ring-1 ring-white/10 overflow-hidden"
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
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-100 truncate">{displayName || user?.username}</h3>
                <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Profile
                </p>
              </div>
            </div>

            {/* Nav Links */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
                User Preferences
              </p>
              <nav className="space-y-1.5">
                <NavTabButton
                  active={activeTab === 'profile'}
                  onClick={() => setActiveTab('profile')}
                  icon={<UserIcon size={16} />}
                  label="Profile & Identity"
                />
                <NavTabButton
                  active={activeTab === 'voice'}
                  onClick={() => setActiveTab('voice')}
                  icon={<Mic size={16} />}
                  label="Voice & Audio"
                />
                <NavTabButton
                  active={activeTab === 'notifications'}
                  onClick={() => setActiveTab('notifications')}
                  icon={<Bell size={16} />}
                  label="Notifications & Sounds"
                />
                <NavTabButton
                  active={activeTab === 'appearance'}
                  onClick={() => setActiveTab('appearance')}
                  icon={<Palette size={16} />}
                  label="Appearance & Theme"
                />
              </nav>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('check-for-updates'))
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-400" />
                <span>Check for Updates</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10">v1.0.0</span>
            </button>

            <button
              onClick={resetToDefaults}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Reset to Defaults</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
            >
              <LogOut size={14} />
              <span>Log Out Account</span>
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c1017]/70 overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-8 py-4 bg-[#0c1017]/90 backdrop-blur-xl border-b border-white/10">
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-slate-100 flex items-center gap-2.5">
                {activeTab === 'profile' && (
                  <>
                    <UserIcon size={20} className="text-emerald-400" />
                    <span>My Profile & Account</span>
                  </>
                )}
                {activeTab === 'voice' && (
                  <>
                    <Mic size={20} className="text-emerald-400" />
                    <span>Voice & Audio Processing</span>
                  </>
                )}
                {activeTab === 'notifications' && (
                  <>
                    <Bell size={20} className="text-emerald-400" />
                    <span>Notifications & Sound Alerts</span>
                  </>
                )}
                {activeTab === 'appearance' && (
                  <>
                    <Palette size={20} className="text-emerald-400" />
                    <span>Appearance & Layout</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === 'profile' && 'Personalize your card banner, avatar, bio, and display name'}
                {activeTab === 'voice' && 'Configure WebRTC noise suppression, devices, and push-to-talk keybinds'}
                {activeTab === 'notifications' && 'Tune in-app sound feedback chimes and OS desktop alerts'}
                {activeTab === 'appearance' && 'Customize theme modes and message density'}
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

          {/* Tab Body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
            {/* ========================================================================= */}
            {/* TAB 1: Profile */}
            {/* ========================================================================= */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl space-y-7">
                {/* Live Profile Card Preview */}
                <div className="rounded-3xl p-5 relative overflow-hidden bg-[#090d14] border border-white/10 shadow-2xl">
                  {/* Header Banner */}
                  <div
                    className="h-32 -m-5 mb-0 rounded-t-3xl relative overflow-hidden transition-all duration-300 flex items-center justify-center"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-transparent to-transparent opacity-80" />
                  </div>

                  {/* Avatar + Quick Badges */}
                  <div className="relative -mt-14 flex items-end justify-between mb-3 px-1">
                    <div
                      className="w-24 h-24 rounded-2xl ring-4 ring-[#090d14] flex items-center justify-center text-2xl font-bold text-white shadow-2xl overflow-hidden transition-all duration-300 relative group"
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

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      <Sparkles size={12} />
                      <span>Live Preview</span>
                    </div>
                  </div>

                  <div className="px-1">
                    <h3 className="text-xl font-black text-slate-100">
                      {displayName || user?.username || 'Username'}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">@{user?.username || 'username'}</p>
                    {bio && (
                      <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                        {bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Profile Banner Customization */}
                <div className="p-5 rounded-2xl space-y-4 bg-white/[0.03] border border-white/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={14} className="text-emerald-400" />
                        <span>Profile Banner</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
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
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
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
                          className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Banner Gradient Presets */}
                  <div className="pt-2 border-t border-white/5">
                    <label className="text-[11px] font-semibold text-slate-400 block mb-2">
                      Or Choose a Gradient Preset
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {BANNER_GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setBannerUrl(preset.bg)
                            setSelectedBannerGradient(preset.bg)
                          }}
                          title={preset.name}
                          className={`h-9 rounded-xl transition-all relative overflow-hidden border ${
                            bannerUrl === preset.bg || selectedBannerGradient === preset.bg
                              ? 'border-white ring-2 ring-emerald-400 shadow-lg scale-105'
                              : 'border-white/10 opacity-75 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{ background: preset.bg }}
                        >
                          {(bannerUrl === preset.bg || selectedBannerGradient === preset.bg) && (
                            <Check size={14} className="text-white mx-auto drop-shadow-md" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Avatar Customization */}
                <div className="p-5 rounded-2xl space-y-4 bg-white/[0.03] border border-white/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} className="text-emerald-400" />
                        <span>User Avatar</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Upload custom avatar image or pick a gradient style
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
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        <span>{isUploadingAvatar ? 'Uploading...' : 'Upload Avatar'}</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl('')}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Avatar Color Presets */}
                  <div className="pt-2 border-t border-white/5">
                    <label className="text-[11px] font-semibold text-slate-400 block mb-2">
                      Avatar Gradient Presets
                    </label>
                    <div className="flex items-center gap-3">
                      {AVATAR_GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setAvatarUrl('')
                            setSelectedGradient(preset.bg)
                          }}
                          title={preset.name}
                          className={`w-9 h-9 rounded-xl transition-all relative border ${
                            !avatarUrl && selectedGradient === preset.bg
                              ? 'border-white ring-2 ring-emerald-400 shadow-lg scale-110'
                              : 'border-white/10 opacity-75 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{ background: preset.bg }}
                        >
                          {!avatarUrl && selectedGradient === preset.bg && (
                            <Check size={14} className="text-white mx-auto drop-shadow-md" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {error && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                      {error}
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                      <Check size={15} />
                      <span>Profile updated successfully!</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter how you appear to others"
                      className="w-full px-4 py-3 rounded-xl text-sm bg-black/40 border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      About Me / Bio
                    </label>
                    <textarea
                      rows={3}
                      maxLength={190}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell your team a little about yourself"
                      className="w-full px-4 py-3 rounded-xl text-sm bg-black/40 border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                    />
                    <p className="text-[11px] text-slate-400 text-right">
                      {bio.length} / 190 characters
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 transition-all shadow-[0_4px_20px_rgba(16,185,129,0.35)] disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: Voice & Audio */}
            {/* ========================================================================= */}
            {activeTab === 'voice' && (
              <div className="max-w-2xl space-y-7">
                {/* Device Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Mic size={14} className="text-emerald-400" />
                      <span>Input Device (Microphone)</span>
                    </label>
                    <select
                      value={settings.inputDeviceId}
                      onChange={(e) => updateSettings({ inputDeviceId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#080c14] border border-white/10 text-slate-100 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
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
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 size={14} className="text-emerald-400" />
                      <span>Output Device (Headphones)</span>
                    </label>
                    <select
                      value={settings.outputDeviceId}
                      onChange={(e) => updateSettings({ outputDeviceId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#080c14] border border-white/10 text-slate-100 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
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
                  <div className="p-4 rounded-2xl space-y-2 bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Input Volume</span>
                      <span className="text-emerald-400 font-mono">{settings.inputVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.inputVolume}
                      onChange={(e) => updateSettings({ inputVolume: Number(e.target.value) })}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-2xl space-y-2 bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Output Volume</span>
                      <span className="text-emerald-400 font-mono">{settings.outputVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={settings.outputVolume}
                      onChange={(e) => updateSettings({ outputVolume: Number(e.target.value) })}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Input Mode: Voice Activity vs Push-to-Talk */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Transmission Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateSettings({ inputMode: 'voice_activity' })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        settings.inputMode === 'voice_activity'
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-lg'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <Radio size={16} className={settings.inputMode === 'voice_activity' ? 'text-emerald-400' : 'text-slate-400'} />
                          Voice Activity
                        </span>
                        {settings.inputMode === 'voice_activity' && <Check size={16} className="text-emerald-400" />}
                      </div>
                      <p className="text-xs text-slate-400">
                        Transmits automatically when voice is detected
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSettings({ inputMode: 'push_to_talk' })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        settings.inputMode === 'push_to_talk'
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-lg'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <Keyboard size={16} className={settings.inputMode === 'push_to_talk' ? 'text-emerald-400' : 'text-slate-400'} />
                          Push to Talk
                        </span>
                        {settings.inputMode === 'push_to_talk' && <Check size={16} className="text-emerald-400" />}
                      </div>
                      <p className="text-xs text-slate-400">
                        Hold hotkey shortcut during calls to speak
                      </p>
                    </button>
                  </div>

                  {/* PTT Key Recorder */}
                  {settings.inputMode === 'push_to_talk' && (
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between animate-fade-in">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">Push-to-Talk Shortcut</p>
                        <p className="text-xs text-slate-400">
                          Hold this keybind while speaking in any voice channel
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsRecordingPTT(true)}
                        className={`px-4 py-2 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                          isRecordingPTT
                            ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-lg'
                            : 'bg-black/50 text-emerald-400 border-emerald-500/30 hover:border-emerald-400'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Keyboard size={14} />
                          {isRecordingPTT ? 'Press any key...' : settings.pttKey || 'Space'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Voice Sensitivity Threshold */}
                  {settings.inputMode === 'voice_activity' && (
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span>Voice Gate Sensitivity</span>
                        <span className="text-emerald-400 font-mono">{settings.vadSensitivity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={settings.vadSensitivity}
                        onChange={(e) => updateSettings({ vadSensitivity: Number(e.target.value) })}
                        className="w-full accent-emerald-400 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Mic Test Visualizer */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <Mic size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">Microphone Input Test</h4>
                        <p className="text-xs text-slate-400">
                          Verify mic level and noise gate cutoff in real time
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsTestingMic(!isTestingMic)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                        isTestingMic
                          ? 'bg-rose-600 text-white hover:bg-rose-500'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {isTestingMic ? 'Stop Mic Test' : 'Test Microphone'}
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Input Level</span>
                      <span className={micVolume >= settings.vadSensitivity ? 'text-emerald-400' : 'text-slate-400'}>
                        {micVolume}% {micVolume >= settings.vadSensitivity ? '• Transmitting' : '• Gate Closed'}
                      </span>
                    </div>

                    {/* VU Meter */}
                    <div className="relative h-3.5 rounded-full bg-black/60 overflow-hidden p-0.5 border border-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${micVolume}%`,
                          background:
                            micVolume >= settings.vadSensitivity
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : '#475569',
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-emerald-400 z-10 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                        style={{ left: `${settings.vadSensitivity}%` }}
                        title={`Cutoff: ${settings.vadSensitivity}%`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>0% (Quiet)</span>
                      <span className="text-emerald-400 font-medium">Cutoff Threshold: {settings.vadSensitivity}%</span>
                      <span>100% (Loud)</span>
                    </div>
                  </div>
                </div>

                {/* WebRTC DSP Audio Processing Enhancements */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Audio Processing Enhancements
                  </h4>
                  <div className="p-4 rounded-2xl space-y-4 bg-white/[0.03] border border-white/10">
                    <SwitchItem
                      label="Echo Cancellation"
                      desc="Suppresses room reverberation and prevents speaker feedback loop"
                      checked={settings.echoCancellation}
                      onChange={(checked) => updateSettings({ echoCancellation: checked })}
                    />

                    <SwitchItem
                      label="Noise Suppression"
                      desc="Filters background keyboard clicks, computer fans, and room rumble"
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
              <div className="max-w-2xl space-y-7">
                {/* Desktop Notifications Permission Card */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <Bell size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">
                          Desktop System Notifications
                        </h4>
                        <p className="text-xs text-slate-400">
                          Receive banner alerts on mentions and new direct messages
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        notificationPerm === 'granted'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : notificationPerm === 'denied'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      {notificationPerm === 'granted' ? 'Allowed' : notificationPerm === 'denied' ? 'Blocked' : 'Default'}
                    </span>
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-white/5">
                    <span className="text-xs text-slate-400">
                      {notificationPerm === 'granted'
                        ? 'Desktop push notifications are currently active.'
                        : 'Grant browser/system permissions to receive desktop alerts.'}
                    </span>

                    <button
                      type="button"
                      onClick={handleRequestNotifications}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer shadow-md"
                    >
                      {notificationPerm === 'granted' ? 'Verify Permission' : 'Enable Notifications'}
                    </button>
                  </div>
                </div>

                {/* Sound Effects Controls */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Sound Feedback & Chimes
                  </h4>
                  <div className="p-4 rounded-2xl space-y-4 bg-white/[0.03] border border-white/10">
                    <SoundItem
                      title="New Message Chime"
                      desc="Plays a soft alert tone on incoming channel chat messages"
                      checked={settings.soundMessage}
                      onToggle={(checked) => updateSettings({ soundMessage: checked })}
                      onPreview={() => playSoundEffect('message')}
                    />

                    <SoundItem
                      title="Voice Channel Join / Leave"
                      desc="Plays an audio cue when peers enter or exit voice channels"
                      checked={settings.soundVoiceJoinLeave}
                      onToggle={(checked) => updateSettings({ soundVoiceJoinLeave: checked })}
                      onPreview={() => playSoundEffect('join')}
                    />

                    <SoundItem
                      title="Microphone & Deafen Feedback"
                      desc="Plays audio confirmation when toggling mic or headset deafen"
                      checked={settings.soundMuteToggle}
                      onToggle={(checked) => updateSettings({ soundMuteToggle: checked })}
                      onPreview={() => playSoundEffect('mute')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: Appearance */}
            {/* ========================================================================= */}
            {activeTab === 'appearance' && (
              <div className="max-w-2xl space-y-7">
                {/* Theme Selection */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Color Theme Mode
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => theme !== 'dark' && toggleTheme()}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-lg'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                          <Moon size={18} />
                        </div>
                        {theme === 'dark' && <Check size={16} className="text-emerald-400" />}
                      </div>
                      <h5 className="font-bold text-sm text-slate-100">Midnight Dark Mode</h5>
                      <p className="text-xs text-slate-400 mt-1">
                        Deep glassmorphic dark theme tailored for high focus
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => theme !== 'light' && toggleTheme()}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-lg'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                          <Sun size={18} />
                        </div>
                        {theme === 'light' && <Check size={16} className="text-emerald-400" />}
                      </div>
                      <h5 className="font-bold text-sm text-slate-100">Clean Light Mode</h5>
                      <p className="text-xs text-slate-400 mt-1">
                        High ambient daylight theme for clear visibility
                      </p>
                    </button>
                  </div>
                </div>

                {/* Chat Message Layout Density */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Message Display Density
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => updateSettings({ chatDisplayMode: 'cozy' })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        settings.chatDisplayMode === 'cozy'
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-lg'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-100">Cozy Modern Mode</span>
                        {settings.chatDisplayMode === 'cozy' && <Check size={16} className="text-emerald-400" />}
                      </div>
                      <p className="text-xs text-slate-400">
                        Roomy spacing with prominent avatars and clean card breaks
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSettings({ chatDisplayMode: 'compact' })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        settings.chatDisplayMode === 'compact'
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-lg'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-100">Compact Stream Mode</span>
                        {settings.chatDisplayMode === 'compact' && <Check size={16} className="text-emerald-400" />}
                      </div>
                      <p className="text-xs text-slate-400">
                        High-density single-line layout fitting maximum messages
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
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-black/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all border border-white/10 peer-checked:bg-emerald-600 peer-checked:border-emerald-500"></div>
      </label>
    </div>
  )
}

function SoundItem({
  title,
  desc,
  checked,
  onToggle,
  onPreview,
}: {
  title: string
  desc: string
  checked: boolean
  onToggle: (checked: boolean) => void
  onPreview: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPreview}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5 transition-all cursor-pointer"
        >
          Preview
        </button>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-black/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all border border-white/10 peer-checked:bg-emerald-600 peer-checked:border-emerald-500"></div>
        </label>
      </div>
    </div>
  )
}

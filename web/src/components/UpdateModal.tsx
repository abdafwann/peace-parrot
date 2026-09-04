import { useState, useEffect } from 'react'
import {
  Sparkles,
  Download,
  RefreshCw,
  X,
  CheckCircle2,
  ArrowUpCircle,
} from 'lucide-react'

interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  releaseNotes?: string
  publishedAt?: string
  htmlUrl?: string
  downloadUrl?: string
}

export function UpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isBannerVisible, setIsBannerVisible] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [isReadyToRestart, setIsReadyToRestart] = useState(false)
  const [tauriUpdateObj, setTauriUpdateObj] = useState<any>(null)

  const currentAppVersion = '1.0.0'

  // Check for updates on startup
  useEffect(() => {
    // Delay check slightly so initial app boot is fast and smooth
    const timer = setTimeout(() => {
      checkForUpdates(false)
    }, 4000)

    // Listen for manual check trigger from custom events (e.g. from Settings modal)
    const handleManualCheck = () => checkForUpdates(true)
    window.addEventListener('check-for-updates', handleManualCheck)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('check-for-updates', handleManualCheck)
    }
  }, [])

  const checkForUpdates = async (isManual = false) => {
    setIsChecking(true)
    try {
      // 1. Try Tauri Native Updater if running in Tauri desktop
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          const { check } = await import('@tauri-apps/plugin-updater')
          const update = await check()
          if (update?.available) {
            setTauriUpdateObj(update)
            setUpdateInfo({
              available: true,
              currentVersion: update.currentVersion || currentAppVersion,
              latestVersion: update.version,
              releaseNotes: update.body || 'New features, performance enhancements, and bug fixes.',
              publishedAt: update.date || new Date().toISOString(),
              downloadUrl: 'https://github.com/abdafwann/peace-parrot/releases/latest',
            })
            setIsBannerVisible(true)
            if (isManual) setIsOpen(true)
            setIsChecking(false)
            return
          }
        } catch (tauriErr) {
          console.log('[Updater] Tauri updater check skipped/fallback to GitHub API:', tauriErr)
        }
      }

      // 2. Fallback: Check GitHub Releases API
      const res = await fetch('https://api.github.com/repos/abdafwann/peace-parrot/releases/latest', {
        headers: { Accept: 'application/vnd.github.v3+json' },
      })

      if (res.ok) {
        const release = await res.json()
        const tagName = (release.tag_name || '').replace(/^v/, '')

        // Compare version strings (e.g. "1.0.1" > "1.0.0")
        const isNewer = compareVersions(tagName, currentAppVersion) > 0

        const msiAsset = release.assets?.find((a: any) => a.name.endsWith('.msi'))
        const exeAsset = release.assets?.find((a: any) => a.name.endsWith('.exe'))
        const downloadUrl = exeAsset?.browser_download_url || msiAsset?.browser_download_url || release.html_url

        const info: UpdateInfo = {
          available: isNewer,
          currentVersion: currentAppVersion,
          latestVersion: tagName || currentAppVersion,
          releaseNotes: release.body || 'Includes latest bug fixes and improvements.',
          publishedAt: release.published_at,
          htmlUrl: release.html_url,
          downloadUrl,
        }

        setUpdateInfo(info)
        if (isNewer) {
          setIsBannerVisible(true)
          if (isManual) setIsOpen(true)
        } else if (isManual) {
          // If manual check and already up to date, show modal briefly with up-to-date message
          setIsOpen(true)
        }
      }
    } catch (err) {
      console.error('[Updater] Failed to check for updates:', err)
    } finally {
      setIsChecking(false)
    }
  }

  // Simple semver compare: returns 1 if a > b, -1 if a < b, 0 if equal
  const compareVersions = (v1: string, v2: string) => {
    const p1 = v1.split('.').map(Number)
    const p2 = v2.split('.').map(Number)
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0
      const num2 = p2[i] || 0
      if (num1 > num2) return 1
      if (num1 < num2) return -1
    }
    return 0
  }

  // Handle in-app update installation
  const handleInstallUpdate = async () => {
    if (tauriUpdateObj) {
      setIsUpdating(true)
      setUpdateStatus('Downloading update...')
      setUpdateProgress(10)

      try {
        let downloaded = 0
        let contentLength = 0

        await tauriUpdateObj.downloadAndInstall((event: any) => {
          if (event.event === 'Started') {
            contentLength = event.data.contentLength || 0
            setUpdateStatus('Starting download...')
          } else if (event.event === 'Progress') {
            downloaded += event.data.chunkLength
            const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 50
            setUpdateProgress(pct)
            setUpdateStatus(`Downloading update (${pct}%)...`)
          } else if (event.event === 'Finished') {
            setUpdateProgress(100)
            setUpdateStatus('Update downloaded successfully!')
          }
        })

        setIsReadyToRestart(true)
        setUpdateStatus('Ready to restart and apply update!')
      } catch (err: any) {
        console.error('[Updater] Install failed:', err)
        setUpdateStatus('Failed to install update automatically.')
        if (updateInfo?.downloadUrl) {
          window.open(updateInfo.downloadUrl, '_blank')
        }
      } finally {
        setIsUpdating(false)
      }
    } else if (updateInfo?.downloadUrl) {
      // If outside Tauri or no tauri updater object, open direct download link
      window.open(updateInfo.downloadUrl, '_blank')
    }
  }

  // Restart app to apply update
  const handleRestartApp = async () => {
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch {
      window.location.reload()
    }
  }

  return (
    <>
      {/* 1. TOP FLOATING NOTIFICATION BANNER */}
      {isBannerVisible && updateInfo?.available && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0c1017]/95 border border-emerald-500/40 shadow-[0_10px_30px_rgba(16,185,129,0.25)] backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="animate-pulse" />
          </div>

          <div className="text-xs">
            <div className="font-bold text-slate-100 flex items-center gap-1.5">
              <span>PeaceParrot v{updateInfo.latestVersion} Available!</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                NEW
              </span>
            </div>
            <p className="text-slate-400 text-[11px] truncate max-w-xs">
              A new update is ready with improvements & fixes.
            </p>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => setIsOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_2px_10px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Download size={13} />
              <span>Update Now</span>
            </button>

            <button
              onClick={() => setIsBannerVisible(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 2. INTERACTIVE UPDATE MODAL DIALOG */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-[#0c1017] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="relative p-6 bg-gradient-to-b from-emerald-950/40 to-transparent border-b border-white/10 flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  {updateInfo?.available ? (
                    <ArrowUpCircle size={26} className="animate-bounce" />
                  ) : (
                    <CheckCircle2 size={26} className="text-emerald-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{updateInfo?.available ? 'Update PeaceParrot' : 'You are Up to Date!'}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Current Version: <span className="font-mono text-slate-200">v{currentAppVersion}</span>
                    {updateInfo?.available && (
                      <> ➔ Latest: <span className="font-mono text-emerald-400 font-bold">v{updateInfo.latestVersion}</span></>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
              {updateInfo?.available ? (
                <>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      What's New in v{updateInfo.latestVersion}:
                    </h4>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                      {updateInfo.releaseNotes}
                    </div>
                  </div>

                  {/* Progress Bar (when downloading) */}
                  {isUpdating && (
                    <div className="space-y-2 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/20">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                        <span>{updateStatus}</span>
                        <span>{updateProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                          style={{ width: `${updateProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Ready to Restart Notice */}
                  {isReadyToRestart && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                      <div className="text-xs text-emerald-200">
                        <p className="font-bold">Update Ready!</p>
                        <p className="text-[11px] text-emerald-300/80">
                          Click "Restart App" below to apply the update immediately.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
                  <p className="font-bold text-sm text-slate-200">PeaceParrot is on the latest version</p>
                  <p className="text-xs text-slate-400">
                    You have all the newest features, audio enhancements, and security patches.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-5 bg-white/[0.02] border-t border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={() => checkForUpdates(true)}
                disabled={isChecking}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} />
                <span>{isChecking ? 'Checking...' : 'Check Again'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                >
                  Close
                </button>

                {updateInfo?.available && (
                  isReadyToRestart ? (
                    <button
                      onClick={handleRestartApp}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} />
                      <span>Restart App</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleInstallUpdate}
                      disabled={isUpdating}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Download size={14} />
                      <span>{isUpdating ? 'Updating...' : 'Update In-App'}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

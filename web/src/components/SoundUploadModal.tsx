import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Play, Pause, Upload, Loader2 } from 'lucide-react'
import { decodeAudioFile, sliceAndEncodeWav } from '../utils/audioTrimmer'
import { SoundboardItem } from '../utils/soundboardAudio'
import { toast } from '../stores/toastStore'
import { API_BASE_URL } from '../utils/config'

interface SoundUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSoundAdded: (sound: SoundboardItem) => void
}

const EMOJI_OPTIONS = [
  '🎺', '🦆', '🥁', '🏆', '💥', '🦜', '🎉', '⭐', '💀', '🔥',
  '😂', '🤖', '🎮', '🔔', '📣', '🍿', '⚡', '💣', '🤪', '🚀'
]

export function SoundUploadModal({
  isOpen,
  onClose,
  onSoundAdded,
}: SoundUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [duration, setDuration] = useState<number>(0)

  // Trim points (in seconds)
  const [startTrim, setStartTrim] = useState<number>(0)
  const [endTrim, setEndTrim] = useState<number>(0)
  const [playheadTime, setPlayheadTime] = useState<number>(0)

  // Meta fields
  const [soundName, setSoundName] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('🎵')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [volume, setVolume] = useState<number>(0.8)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Dragging interaction state
  const [dragMode, setDragMode] = useState<'none' | 'start' | 'end' | 'playhead'>('none')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const waveformContainerRef = useRef<HTMLDivElement>(null)
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const startTimeRef = useRef<number>(0)
  const startOffsetRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        stopPlayback()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioCtxRef.current = new AudioContextClass()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  const stopPlayback = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop()
        activeSourceRef.current.disconnect()
      } catch {}
      activeSourceRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return
    stopPlayback()

    // Validate audio file format
    const validExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus']
    const isAudioExt = validExts.some((ext) => selectedFile.name.toLowerCase().endsWith(ext))
    if (!selectedFile.type.startsWith('audio/') && !isAudioExt) {
      toast.error('Only audio files (.mp3, .wav, .ogg, .m4a, .flac) are allowed for the Soundboard.')
      return
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      toast.error('File exceeds 25 MB limit.')
      return
    }

    try {
      const decoded = await decodeAudioFile(selectedFile)
      setFile(selectedFile)
      setAudioBuffer(decoded.audioBuffer)
      setPeaks(decoded.peaks)
      setDuration(decoded.duration)
      setStartTrim(0)
      const initialEnd = Math.min(decoded.duration, 10.0)
      setEndTrim(initialEnd)
      setPlayheadTime(0)

      if (!soundName) {
        setSoundName(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    } catch {
      toast.error('Failed to decode audio file. Try an MP3, WAV, or OGG file.')
    }
  }

  const handleTogglePlay = () => {
    if (!audioBuffer || duration <= 0) return

    if (isPlaying) {
      stopPlayback()
      return
    }

    const ctx = getAudioContext()
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(volume, ctx.currentTime)

    source.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Play from playhead if it's within start..end, otherwise start from startTrim
    let offset = playheadTime
    if (offset < startTrim || offset >= endTrim - 0.05) {
      offset = startTrim
      setPlayheadTime(startTrim)
    }

    const playDuration = Math.max(0.1, endTrim - offset)

    source.start(0, offset, playDuration)
    activeSourceRef.current = source
    setIsPlaying(true)
    startTimeRef.current = ctx.currentTime
    startOffsetRef.current = offset

    // Animate the blue scrubber playhead line
    const updateScrubber = () => {
      const elapsed = ctx.currentTime - startTimeRef.current
      const currentPos = startOffsetRef.current + elapsed
      if (currentPos >= endTrim) {
        setPlayheadTime(startTrim)
        stopPlayback()
      } else {
        setPlayheadTime(currentPos)
        animFrameRef.current = requestAnimationFrame(updateScrubber)
      }
    }
    animFrameRef.current = requestAnimationFrame(updateScrubber)

    source.onended = () => {
      stopPlayback()
    }
  }

  // Time conversion helper from mouse clientX
  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      if (!waveformContainerRef.current || duration <= 0) return 0
      const rect = waveformContainerRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return ratio * duration
    },
    [duration]
  )

  // Drag interaction handlers directly on waveform preview
  const handleMouseDownWaveform = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return
    const clickTime = getTimeFromEvent(e.clientX)
    const rect = waveformContainerRef.current?.getBoundingClientRect()
    if (!rect) return

    const clickRatio = (e.clientX - rect.left) / rect.width
    const startRatio = startTrim / duration
    const endRatio = endTrim / duration

    // Check if clicked close to start handle or end handle (tolerance ~ 18px)
    const startPx = startRatio * rect.width
    const endPx = endRatio * rect.width
    const clickPx = clickRatio * rect.width

    if (Math.abs(clickPx - startPx) <= 14) {
      setDragMode('start')
    } else if (Math.abs(clickPx - endPx) <= 14) {
      setDragMode('end')
    } else {
      // Place blue playhead separator where user wants to test
      const clamped = Math.max(startTrim, Math.min(endTrim, clickTime))
      setPlayheadTime(clamped)
      setDragMode('playhead')
      if (isPlaying) {
        stopPlayback()
      }
    }
  }

  // Global mouse move & up for smooth scrubbing / trimming
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragMode === 'none' || duration <= 0) return
      const targetTime = getTimeFromEvent(e.clientX)

      if (dragMode === 'start') {
        const clampedStart = Math.max(0, Math.min(targetTime, endTrim - 0.4))
        setStartTrim(clampedStart)
        if (endTrim - clampedStart > 10.0) {
          setEndTrim(clampedStart + 10.0)
        }
        if (playheadTime < clampedStart) setPlayheadTime(clampedStart)
      } else if (dragMode === 'end') {
        const clampedEnd = Math.min(duration, Math.max(targetTime, startTrim + 0.4))
        setEndTrim(clampedEnd)
        if (clampedEnd - startTrim > 10.0) {
          setStartTrim(clampedEnd - 10.0)
        }
        if (playheadTime > clampedEnd) setPlayheadTime(startTrim)
      } else if (dragMode === 'playhead') {
        const clamped = Math.max(startTrim, Math.min(endTrim, targetTime))
        setPlayheadTime(clamped)
      }
    }

    const handleMouseUp = () => {
      if (dragMode !== 'none') {
        setDragMode('none')
      }
    }

    if (dragMode !== 'none') {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragMode, duration, endTrim, startTrim, playheadTime, getTimeFromEvent])

  const handleUpload = async () => {
    if (!file || !audioBuffer) {
      toast.error('Please select an audio file first.')
      return
    }

    if (!soundName.trim()) {
      toast.error('Sound name is required.')
      return
    }

    const trimmedLength = endTrim - startTrim
    if (trimmedLength > 10.5) {
      toast.error('Soundboard clip must be 10 seconds or shorter.')
      return
    }

    stopPlayback()
    setIsUploading(true)

    try {
      // 1. Slice and encode WAV on the client
      const wavBlob = sliceAndEncodeWav(audioBuffer, startTrim, endTrim, volume)
      const slicedFile = new File([wavBlob], `${soundName.trim()}.wav`, { type: 'audio/wav' })

      let soundUrl = ''

      // 2. Upload to backend
      try {
        const formData = new FormData()
        formData.append('file', slicedFile)
        const token = localStorage.getItem('token') || ''

        const res = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          soundUrl = data.url
        }
      } catch (uploadErr) {
        console.warn('Backend upload skipped or failed, using local audio data:', uploadErr)
      }

      // 3. If server URL not available, use encoded Data URL
      if (!soundUrl) {
        soundUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(wavBlob)
        })
      }

      // 4. Save to server database so all server members get the sound
      const token = localStorage.getItem('token') || ''
      let newSound: SoundboardItem = {
        id: `custom-${Date.now()}`,
        name: soundName.trim(),
        emoji: selectedEmoji,
        category: 'custom',
        duration: `${trimmedLength.toFixed(1)}s`,
        customUrl: soundUrl,
      }

      try {
        const sbRes = await fetch(`${API_BASE_URL}/api/soundboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: soundName.trim(),
            emoji: selectedEmoji,
            duration: `${trimmedLength.toFixed(1)}s`,
            customUrl: soundUrl,
          }),
        })

        if (sbRes.ok) {
          const savedItem = await sbRes.json()
          newSound = savedItem
        }
      } catch (saveErr) {
        console.warn('Failed to save to soundboard backend, using local item:', saveErr)
      }

      onSoundAdded(newSound)
      toast.success(`Sound "${newSound.name}" added to Soundboard!`)
      onClose()
    } catch (err: any) {
      console.error('Failed to process sound:', err)
      toast.error(err?.message || 'Failed to process sound clip.')
    } finally {
      setIsUploading(false)
    }
  }

  const trimmedDuration = Math.max(0, endTrim - startTrim)
  const startPercent = duration > 0 ? (startTrim / duration) * 100 : 0
  const endPercent = duration > 0 ? (endTrim / duration) * 100 : 100
  const playheadPercent = duration > 0 ? (playheadTime / duration) * 100 : 0

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-[#1e1f22] border border-[#2b2d31] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-scale select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Upload a Sound
          </h2>
          <button
            onClick={() => {
              stopPlayback()
              onClose()
            }}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-2 flex flex-col gap-4">
          {/* 1. Preview Waveform Interactive Scrubber Card */}
          <div>
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 block">
              Preview
            </label>

            <div className="bg-[#111214] border border-[#2b2d31] rounded-xl p-3.5 flex items-center gap-3 relative">
              {/* Play Button & Time Indicator */}
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!audioBuffer}
                className={`w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0 transition-all ${
                  audioBuffer
                    ? 'bg-[#2b2d31] hover:bg-[#35373c] text-white cursor-pointer active:scale-95'
                    : 'bg-[#232428] text-gray-500 cursor-not-allowed'
                }`}
                title="Preview sound"
              >
                {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
                <span className="text-[9px] font-mono text-[#f0b232] font-semibold leading-none mt-0.5">
                  {duration > 0 ? `${trimmedDuration.toFixed(2)}s` : '0.0s'}
                </span>
              </button>

              {/* Interactive Waveform Container */}
              <div
                ref={waveformContainerRef}
                onMouseDown={handleMouseDownWaveform}
                className="flex-1 h-14 relative flex items-center overflow-hidden cursor-pointer select-none rounded-lg bg-black/40 px-1"
                title="Drag handles to trim; click anywhere inside to position preview playhead"
              >
                {/* Waveform Bars */}
                <div className="w-full h-full flex items-center justify-between gap-[2px] pointer-events-none">
                  {peaks.length > 0 ? (
                    peaks.map((p: number, idx: number) => {
                      const barPercent = (idx / peaks.length) * duration
                      const isInTrim = barPercent >= startTrim && barPercent <= endTrim
                      return (
                        <div
                          key={idx}
                          className={`w-[2.5px] rounded-full transition-all ${
                            isInTrim ? 'bg-white' : 'bg-gray-700/60'
                          }`}
                          style={{ height: `${Math.max(15, p * 100)}%` }}
                        />
                      )
                    })
                  ) : (
                    <div className="w-full flex items-center justify-center text-xs text-gray-500 italic">
                      Upload an audio file to see waveform & trim
                    </div>
                  )}
                </div>

                {/* Left Shaded Dim Overlay */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none"
                    style={{ width: `${startPercent}%` }}
                  />
                )}

                {/* Right Shaded Dim Overlay */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none"
                    style={{ width: `${100 - endPercent}%` }}
                  />
                )}

                {/* Blue Separator / Playhead Line */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
                    style={{ left: `${playheadPercent}%` }}
                  >
                    <div className="w-[3px] h-full bg-[#5865f2] rounded-full shadow-[0_0_10px_#5865f2]" />
                  </div>
                )}

                {/* Left White Trim Handle */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 z-30 flex items-center cursor-ew-resize group"
                    style={{ left: `calc(${startPercent}% - 6px)` }}
                  >
                    {/* Vertical Line & Pill Handle */}
                    <div className="relative w-3 h-full flex items-center justify-center">
                      <div className="w-[3px] h-full bg-white rounded-full shadow-md" />
                      <div className="absolute w-2 h-5 bg-white rounded-sm shadow-md group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                )}

                {/* Right White Trim Handle */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 z-30 flex items-center cursor-ew-resize group"
                    style={{ left: `calc(${endPercent}% - 6px)` }}
                  >
                    {/* Vertical Line & Pill Handle */}
                    <div className="relative w-3 h-full flex items-center justify-center">
                      <div className="w-[3px] h-full bg-white rounded-full shadow-md" />
                      <div className="absolute w-2 h-5 bg-white rounded-sm shadow-md group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Duration Tag below waveform */}
            {duration > 0 && (
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mt-1 px-1">
                <span>Start: {startTrim.toFixed(2)}s</span>
                <span className="text-[#5865f2] font-semibold">
                  Selected: {trimmedDuration.toFixed(2)}s / 10s max
                </span>
                <span>End: {endTrim.toFixed(2)}s</span>
              </div>
            )}
          </div>

          {/* 2. File Selector */}
          <div>
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              File <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center justify-between px-3 py-2 bg-[#111214] border border-[#2b2d31] rounded-xl">
              <div className="flex items-center gap-2 text-sm text-gray-300 truncate min-w-0 pr-2">
                <Upload size={16} className="text-gray-400 shrink-0" />
                <span className="truncate">{file ? file.name : 'No file selected'}</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-1 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
              >
                Browse
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          </div>

          {/* 3. Sound Name & Related Emoji Row */}
          <div className="grid grid-cols-[1.5fr_1fr] gap-3">
            {/* Sound Name */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                Sound Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={soundName}
                onChange={(e) => setSoundName(e.target.value)}
                placeholder="Sound Name"
                className="w-full bg-[#111214] border border-[#2b2d31] focus:border-[#5865f2] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                maxLength={30}
              />
            </div>

            {/* Related Emoji */}
            <div className="relative">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 block">
                Related Emoji
              </label>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-full flex items-center justify-center gap-2 bg-[#111214] border border-[#2b2d31] hover:border-gray-500 rounded-xl px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors cursor-pointer h-[38px]"
              >
                <span className="text-lg leading-none">{selectedEmoji}</span>
                <span className="text-xs text-gray-400 truncate">Select</span>
              </button>

              {/* Emoji popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-12 right-0 z-50 p-2.5 rounded-2xl bg-[#2b2d31] border border-[#383a40] shadow-2xl grid grid-cols-5 gap-1.5 w-52 animate-fade-in-scale">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setSelectedEmoji(em)
                        setShowEmojiPicker(false)
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-white/10 text-lg flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Sound Volume Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              <span>Sound Volume</span>
              <span className="font-mono text-gray-400 font-normal lowercase">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#5865f2]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 mt-2 bg-[#18191c]">
          <button
            type="button"
            onClick={() => {
              stopPlayback()
              onClose()
            }}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white hover:underline transition-all cursor-pointer"
          >
            Never mind
          </button>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || !soundName.trim() || isUploading}
            className={`px-6 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-md flex items-center gap-2 ${
              file && soundName.trim() && !isUploading
                ? 'bg-[#5865f2] hover:bg-[#4752c4] active:scale-95 cursor-pointer'
                : 'bg-[#5865f2]/50 text-white/50 cursor-not-allowed'
            }`}
          >
            {isUploading && <Loader2 size={16} className="animate-spin" />}
            Upload
          </button>
        </div>
      </div>
    </div>
  )
}

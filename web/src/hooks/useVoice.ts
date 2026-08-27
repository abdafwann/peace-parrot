import { useRef, useCallback, useEffect } from 'react'
import { useVoiceStore } from '../stores/voiceStore'

// ============================================================================
// VoiceRefs - Non-serializable, live objects (spec Section 3.2)
// These should NOT be in Zustand - use useRef instead
// ============================================================================

export interface VoiceRefs {
  localStream: MediaStream | null
  screenStream: MediaStream | null
  sfuConnection: RTCPeerConnection | null
  audioContext: AudioContext | null
}

// ============================================================================
// useVoiceRef - Manages non-serializable WebRTC objects
// ============================================================================

export function useVoiceRef() {
  const refs = useRef<VoiceRefs>({
    localStream: null,
    screenStream: null,
    sfuConnection: null,
    audioContext: null,
  })

  // Get media stream for audio analysis
  const getAudioStream = useCallback(() => refs.current.localStream, [])

  // Set local stream
  const setLocalStream = useCallback((stream: MediaStream | null) => {
    refs.current.localStream = stream
  }, [])

  // Set screen stream
  const setScreenStream = useCallback((stream: MediaStream | null) => {
    refs.current.screenStream = stream
  }, [])

  // Set SFU connection
  const setSfuConnection = useCallback((conn: RTCPeerConnection | null) => {
    refs.current.sfuConnection = conn
  }, [])

  // Set audio context
  const setAudioContext = useCallback((ctx: AudioContext | null) => {
    refs.current.audioContext = ctx
  }, [])

  // Stop all tracks (cleanup step 1)
  const stopAllTracks = useCallback(() => {
    refs.current.localStream?.getTracks().forEach(t => t.stop())
    refs.current.screenStream?.getTracks().forEach(t => t.stop())
  }, [])

  // Close SFU connection (cleanup step 2)
  const closeSfuConnection = useCallback(() => {
    refs.current.sfuConnection?.close()
    refs.current.sfuConnection = null
  }, [])

  // Close audio context (cleanup step 3)
  const closeAudioContext = useCallback(() => {
    refs.current.audioContext?.close()
    refs.current.audioContext = null
  }, [])

  // Clear all refs (cleanup step 4)
  const clearRefs = useCallback(() => {
    refs.current.localStream = null
    refs.current.screenStream = null
    refs.current.sfuConnection = null
    refs.current.audioContext = null
  }, [])

  return {
    refs,
    getAudioStream,
    setLocalStream,
    setScreenStream,
    setSfuConnection,
    setAudioContext,
    stopAllTracks,
    closeSfuConnection,
    closeAudioContext,
    clearRefs,
  }
}

// ============================================================================
// useSpeakingDetection - Audio analysis hook (spec Section 3.3)
// ============================================================================

interface SpeakingDetectionOptions {
  // Interval in ms (default 100ms as per spec)
  interval?: number
  // Threshold for speaking detection (default 20 as per spec)
  threshold?: number
}

export function useSpeakingDetection(
  stream: MediaStream | null,
  onSpeakingChange: (userId: string, isSpeaking: boolean) => void,
  userId: string,
  options: SpeakingDetectionOptions = {}
) {
  const { interval = 100, threshold = 20 } = options

  useEffect(() => {
    if (!stream) return

    // Create audio context and analyser
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    let isSpeaking = false
    let animationFrameId: number | null = null

    const detect = () => {
      analyser.getByteFrequencyData(dataArray)

      // Calculate average frequency
      const sum = dataArray.reduce((a, b) => a + b, 0)
      const avg = sum / dataArray.length

      const nowSpeaking = avg > threshold

      if (nowSpeaking !== isSpeaking) {
        isSpeaking = nowSpeaking
        onSpeakingChange(userId, isSpeaking)
      }

      animationFrameId = requestAnimationFrame(detect)
    }

    // Use setInterval as specified (100ms interval)
    const intervalId = setInterval(() => {
      if (animationFrameId === null) {
        detect()
      }
    }, interval)

    return () => {
      clearInterval(intervalId)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      source.disconnect()
      audioContext.close()
    }
  }, [stream, onSpeakingChange, userId, interval, threshold])
}

// ============================================================================
// useVoiceCleanup - Handles cleanup on leave (spec Section 3.4)
// ============================================================================

export function useVoiceCleanup() {
  const voiceRef = useVoiceRef()
  const reset = useVoiceStore((state) => state.reset)

  const leaveChannel = useCallback(() => {
    // 1. Stop all tracks
    voiceRef.stopAllTracks()

    // 2. Close SFU connection
    voiceRef.closeSfuConnection()

    // 3. Close audio context
    voiceRef.closeAudioContext()

    // 4. Clear refs
    voiceRef.clearRefs()

    // 5. Wipe Zustand state
    reset()
  }, [voiceRef, reset])

  return {
    ...voiceRef,
    leaveChannel,
  }
}

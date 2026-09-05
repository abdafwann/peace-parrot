import { useEffect, useRef } from 'react'
import {
  useVoiceStore,
  getSavedUserVolume,
  getSavedUserLocalMute,
} from '../stores/voiceStore'
import { useWebSocketStore, type WSMessage } from '../stores/websocketStore'
import { useSettingsStore } from '../stores/settingsStore'

interface UserAudioNode {
  userId: string
  trackId: string
  stream: MediaStream
  sourceNode?: MediaStreamAudioSourceNode
  gainNode?: GainNode
  audioEl?: HTMLAudioElement
}

export function useSFU() {
  const channelId = useVoiceStore((state) => state.channelId)
  const selfMuted = useVoiceStore((state) => state.selfMuted)
  const selfDeafened = useVoiceStore((state) => state.selfDeafened)
  const setParticipantSpeaking = useVoiceStore((state) => state.setParticipantSpeaking)

  const send = useWebSocketStore((state) => state.send)
  const subscribe = useWebSocketStore((state) => state.subscribe)

  const settings = useSettingsStore()

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const userAudioNodesRef = useRef<Record<string, UserAudioNode>>({})
  const remoteAudioCtxRef = useRef<AudioContext | null>(null)
  const iceBufferRef = useRef<RTCIceCandidateInit[]>([])
  const isRemoteSetRef = useRef(false)
  const localAudioContextRef = useRef<AudioContext | null>(null)
  const isPttPressedRef = useRef(false)

  // WebRTC Connection Lifecycle
  useEffect(() => {
    if (!channelId) {
      cleanup()
      return
    }

    const activeChanId = channelId
    let isMounted = true

    async function initConnection() {
      try {
        console.log('[useSFU] Initializing SFU connection for channel:', activeChanId)

        // 1. Create PeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        })
        pcRef.current = pc
        isRemoteSetRef.current = false
        iceBufferRef.current = []

        // 2. Handle outgoing ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && activeChanId) {
            send({
              type: 'webrtc_ice',
              channelId: activeChanId,
              payload: {
                channelId: activeChanId,
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid || '',
                sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
              },
            })
          }
        }

        // 3. Handle incoming remote tracks (audio playback from SFU with GainNode routing)
        pc.ontrack = (event) => {
          console.log('[useSFU] Received remote track from SFU:', event.track.id, event.track.kind)
          if (event.track.kind === 'audio') {
            const trackId = event.track.id
            const streamId = event.streams && event.streams[0] ? event.streams[0].id : ''
            const mediaStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track])

            // Parse userId from "audio-<userId>" or "stream-<userId>"
            const userId = trackId.startsWith('audio-')
              ? trackId.slice(6)
              : (streamId.startsWith('stream-') ? streamId.slice(7) : trackId)

            setupRemoteAudioNode(userId, trackId, mediaStream)
          }
        }

        // 4. Capture microphone stream using dynamic settings constraints
        let stream: MediaStream
        try {
          const currentSettings = useSettingsStore.getState()
          const constraints: MediaStreamConstraints = {
            audio: {
              deviceId: currentSettings.inputDeviceId ? { exact: currentSettings.inputDeviceId } : undefined,
              echoCancellation: currentSettings.echoCancellation,
              noiseSuppression: currentSettings.noiseSuppression,
              autoGainControl: currentSettings.autoGainControl,
            },
            video: false,
          }
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (mediaErr) {
          console.warn('[useSFU] getUserMedia error (fallback to audio transceiver):', mediaErr)
          stream = new MediaStream()
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        localStreamRef.current = stream

        // Apply initial mute / PTT state
        const isPTT = settings.inputMode === 'push_to_talk'
        stream.getAudioTracks().forEach((track) => {
          track.enabled = isPTT ? false : !selfMuted
          pc.addTrack(track, stream)
        })

        // Ensure audio transceivers are added so we can receive incoming audio tracks
        pc.addTransceiver('audio', { direction: 'recvonly' })
        pc.addTransceiver('audio', { direction: 'recvonly' })

        // 5. Setup Speaking Detection via AudioContext AnalyserNode
        if (stream.getAudioTracks().length > 0) {
          setupSpeakingDetection(stream, activeChanId)
        }

        // 6. Create and send WebRTC Offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        console.log('[useSFU] Sending WebRTC offer to server...')
        send({
          type: 'webrtc_offer',
          channelId: activeChanId,
          payload: {
            channelId: activeChanId,
            sdp: offer.sdp,
          },
        })
      } catch (err) {
        console.error('[useSFU] Failed to initialize WebRTC connection:', err)
      }
    }

    initConnection()

    // 7. Subscribe to WebSocket signaling events
    const unsubscribe = subscribe((msg: WSMessage) => {
      const pc = pcRef.current

      // Handle WebRTC Answer from SFU
      if (msg.type === 'webrtc_answer' && pc) {
        const payload = msg.payload as { sdp?: string }
        if (payload?.sdp) {
          console.log('[useSFU] Setting remote description (Answer)...')
          pc.setRemoteDescription(
            new RTCSessionDescription({
              type: 'answer',
              sdp: payload.sdp,
            })
          )
            .then(() => {
              isRemoteSetRef.current = true
              console.log('[useSFU] Remote description set successfully. Flushing ICE buffer:', iceBufferRef.current.length)
              while (iceBufferRef.current.length > 0) {
                const candidate = iceBufferRef.current.shift()
                if (candidate) {
                  pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) =>
                    console.error('[useSFU] Error adding buffered ICE candidate:', err)
                  )
                }
              }
            })
            .catch((err) => {
              console.error('[useSFU] Failed to set remote description:', err)
            })
        }
      }

      // Handle renegotiation offer from SFU
      if (msg.type === 'webrtc_offer' && pc) {
        const payload = msg.payload as { sdp?: string; channelId?: string }
        if (payload?.sdp) {
          console.log('[useSFU] Received renegotiation offer from SFU...')
          pc.setRemoteDescription(
            new RTCSessionDescription({
              type: 'offer',
              sdp: payload.sdp,
            })
          )
            .then(async () => {
              isRemoteSetRef.current = true
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)

              const targetChan = channelId || (payload.channelId as string)
              if (targetChan) {
                send({
                  type: 'webrtc_answer',
                  channelId: targetChan,
                  payload: {
                    channelId: targetChan,
                    sdp: answer.sdp,
                  },
                })
              }
            })
            .catch((err) => {
              console.error('[useSFU] Error handling renegotiation offer:', err)
            })
        }
      }

      // Handle ICE candidates from SFU
      if (msg.type === 'webrtc_ice' && pc) {
        const payload = msg.payload as {
          candidate?: string
          sdpMid?: string
          sdpMLineIndex?: number
        }
        if (payload?.candidate) {
          const iceInit: RTCIceCandidateInit = {
            candidate: payload.candidate,
            sdpMid: payload.sdpMid || undefined,
            sdpMLineIndex: payload.sdpMLineIndex,
          }

          if (isRemoteSetRef.current) {
            pc.addIceCandidate(new RTCIceCandidate(iceInit)).catch((err) =>
              console.error('[useSFU] Error adding ICE candidate:', err)
            )
          } else {
            iceBufferRef.current.push(iceInit)
          }
        }
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
      cleanup()
    }
  }, [channelId, subscribe, send])

  // Setup Web Audio GainNode & Audio element routing for a remote user
  function setupRemoteAudioNode(userId: string, trackId: string, stream: MediaStream) {
    try {
      // 1. Clean up existing node if replacing
      if (userAudioNodesRef.current[userId]) {
        try {
          userAudioNodesRef.current[userId].sourceNode?.disconnect()
          userAudioNodesRef.current[userId].gainNode?.disconnect()
          userAudioNodesRef.current[userId].audioEl?.remove()
        } catch {}
      }

      // 2. Initialize AudioContext
      let ctx = remoteAudioCtxRef.current
      if (!ctx || ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        ctx = new AudioCtx()
        remoteAudioCtxRef.current = ctx
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }

      // 3. Connect: MediaStream -> SourceNode -> GainNode -> Destination
      const sourceNode = ctx.createMediaStreamSource(stream)
      const gainNode = ctx.createGain()

      const userVol = getSavedUserVolume(userId)
      const localMuted = getSavedUserLocalMute(userId)
      const masterVol = (useSettingsStore.getState().outputVolume ?? 100) / 100
      const isDeafened = useVoiceStore.getState().selfDeafened

      const effectiveGain = localMuted || isDeafened ? 0 : userVol * masterVol
      gainNode.gain.setValueAtTime(effectiveGain, ctx.currentTime)

      sourceNode.connect(gainNode)
      gainNode.connect(ctx.destination)

      // 4. Create an invisible audio element to keep the stream alive
      const audioEl = document.createElement('audio')
      audioEl.srcObject = stream
      audioEl.autoplay = true
      audioEl.muted = true // AudioContext handles sound with GainNode (0% - 200%)
      audioEl.style.display = 'none'
      document.body.appendChild(audioEl)
      audioEl.play().catch(() => {})

      userAudioNodesRef.current[userId] = {
        userId,
        trackId,
        stream,
        sourceNode,
        gainNode,
        audioEl,
      }

      console.log(`[useSFU] Audio node initialized for user ${userId} with initial gain: ${effectiveGain}`)
    } catch (err) {
      console.error(`[useSFU] Failed to setup Web Audio for user ${userId}:`, err)
    }
  }

  // Recalculate and apply gain for all connected remote users
  function syncAllUserGains() {
    const ctx = remoteAudioCtxRef.current
    if (!ctx || ctx.state === 'closed') return

    const masterVol = (useSettingsStore.getState().outputVolume ?? 100) / 100
    const isDeafened = useVoiceStore.getState().selfDeafened
    const now = ctx.currentTime

    Object.values(userAudioNodesRef.current).forEach((node) => {
      if (node.gainNode) {
        const userVol = getSavedUserVolume(node.userId)
        const localMuted = getSavedUserLocalMute(node.userId)
        const effectiveGain = localMuted || isDeafened ? 0 : userVol * masterVol

        node.gainNode.gain.setValueAtTime(effectiveGain, now)
      }
    })
  }

  // Listen to per-user volume & local mute changes
  useEffect(() => {
    const handleVolumeEvent = (e: any) => {
      const detail = e.detail as { userId?: string; volume?: number; localMuted?: boolean }
      const ctx = remoteAudioCtxRef.current
      if (!ctx || ctx.state === 'closed') return

      if (detail?.userId && userAudioNodesRef.current[detail.userId]) {
        const node = userAudioNodesRef.current[detail.userId]
        if (node.gainNode) {
          const userVol = getSavedUserVolume(detail.userId)
          const localMuted = getSavedUserLocalMute(detail.userId)
          const masterVol = (useSettingsStore.getState().outputVolume ?? 100) / 100
          const isDeafened = useVoiceStore.getState().selfDeafened
          const effectiveGain = localMuted || isDeafened ? 0 : userVol * masterVol

          node.gainNode.gain.setValueAtTime(effectiveGain, ctx.currentTime)
        }
      } else {
        syncAllUserGains()
      }
    }

    window.addEventListener('user-volume-changed', handleVolumeEvent)
    return () => window.removeEventListener('user-volume-changed', handleVolumeEvent)
  }, [])

  // Sync Push-to-Talk (PTT) key listeners
  useEffect(() => {
    if (!channelId || settings.inputMode !== 'push_to_talk') return

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (targetTag === 'input' || targetTag === 'textarea') return

      const keyMatch = e.code === settings.pttKey || e.key === settings.pttKey
      if (keyMatch && !isPttPressedRef.current) {
        isPttPressedRef.current = true
        if (localStreamRef.current && !selfMuted) {
          localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = true
          })
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyMatch = e.code === settings.pttKey || e.key === settings.pttKey
      if (keyMatch && isPttPressedRef.current) {
        isPttPressedRef.current = false
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = false
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [channelId, settings.inputMode, settings.pttKey, selfMuted])

  // Sync mute state with microphone track
  useEffect(() => {
    if (localStreamRef.current) {
      const isPTT = settings.inputMode === 'push_to_talk'
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isPTT ? isPttPressedRef.current : !selfMuted
      })
    }
  }, [selfMuted, settings.inputMode])

  // Real-time DSP Constraints Synchronization (Echo Cancellation, Noise Suppression, AGC)
  useEffect(() => {
    if (!localStreamRef.current) return

    const track = localStreamRef.current.getAudioTracks()[0]
    if (!track) return

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
    }

    if (typeof track.applyConstraints === 'function') {
      track.applyConstraints(audioConstraints).catch((err) => {
        console.log('[useSFU] applyConstraints note:', err)
      })
    }
  }, [settings.echoCancellation, settings.noiseSuppression, settings.autoGainControl])

  // Sync master volume and self-deafen state with all remote users
  useEffect(() => {
    syncAllUserGains()
  }, [selfDeafened, settings.outputVolume])

  // Setup speaking detection and voice activity gating via Web Audio AnalyserNode
  function setupSpeakingDetection(stream: MediaStream, activeChanId: string) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      localAudioContextRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let isSpeaking = false
      let silenceTimer: ReturnType<typeof setTimeout> | null = null
      const HOLD_TIME_MS = 300 // Hangover hold time to prevent clipping speech

      const checkSpeaking = () => {
        if (!localAudioContextRef.current || localAudioContextRef.current.state === 'closed') return

        const currentSettings = useSettingsStore.getState()
        const isPTT = currentSettings.inputMode === 'push_to_talk'

        // If self-muted, cut transmission immediately
        if (useVoiceStore.getState().selfMuted) {
          if (isSpeaking) {
            isSpeaking = false
            setParticipantSpeaking('local', false)
          }
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => {
              track.enabled = false
            })
          }
          return
        }

        // In Push-to-Talk mode
        if (isPTT) {
          const pttActive = isPttPressedRef.current
          if (pttActive !== isSpeaking) {
            isSpeaking = pttActive
            setParticipantSpeaking('local', isSpeaking)
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = isSpeaking
              })
            }
            send({
              type: 'speaking',
              channelId: activeChanId,
              payload: {
                channelId: activeChanId,
                speaking: isSpeaking,
              },
            })
          }
          return
        }

        // Voice Activity Mode: Calculate input volume level (0 - 100)
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        const volumeLevel = Math.min(100, Math.round((avg / 128) * (currentSettings.inputVolume / 100) * 100))
        const threshold = currentSettings.vadSensitivity

        // Ensure audio track is always enabled when not muted
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = true
          })
        }

        if (volumeLevel >= threshold) {
          if (silenceTimer) {
            clearTimeout(silenceTimer)
            silenceTimer = null
          }

          if (!isSpeaking) {
            isSpeaking = true
            setParticipantSpeaking('local', true)
            send({
              type: 'speaking',
              channelId: activeChanId,
              payload: {
                channelId: activeChanId,
                speaking: true,
              },
            })
          }
        } else {
          // Below threshold: hold for HOLD_TIME_MS before turning off speaking indicator
          if (isSpeaking && !silenceTimer) {
            silenceTimer = setTimeout(() => {
              isSpeaking = false
              silenceTimer = null
              setParticipantSpeaking('local', false)
              send({
                type: 'speaking',
                channelId: activeChanId,
                payload: {
                  channelId: activeChanId,
                  speaking: false,
                },
              })
            }, HOLD_TIME_MS)
          }
        }
      }

      const intervalId = setInterval(checkSpeaking, 50)

      return () => {
        clearInterval(intervalId)
        if (silenceTimer) clearTimeout(silenceTimer)
        source.disconnect()
        ctx.close().catch(() => {})
      }
    } catch (err) {
      console.warn('[useSFU] AudioContext speaking detection warning:', err)
    }
  }

  // Complete cleanup
  function cleanup() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }

    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    if (localAudioContextRef.current) {
      localAudioContextRef.current.close().catch(() => {})
      localAudioContextRef.current = null
    }

    if (remoteAudioCtxRef.current) {
      remoteAudioCtxRef.current.close().catch(() => {})
      remoteAudioCtxRef.current = null
    }

    Object.values(userAudioNodesRef.current).forEach((node) => {
      try {
        node.sourceNode?.disconnect()
        node.gainNode?.disconnect()
        node.audioEl?.remove()
      } catch {}
    })
    userAudioNodesRef.current = {}
    iceBufferRef.current = []
    isRemoteSetRef.current = false
  }
}

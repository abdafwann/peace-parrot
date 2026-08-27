import { useEffect, useRef } from 'react'
import { useVoiceStore } from '../stores/voiceStore'
import { useWebSocketStore, type WSMessage } from '../stores/websocketStore'

interface AudioElementMap {
  [trackId: string]: HTMLAudioElement
}

export function useSFU() {
  const channelId = useVoiceStore((state) => state.channelId)
  const selfMuted = useVoiceStore((state) => state.selfMuted)
  const selfDeafened = useVoiceStore((state) => state.selfDeafened)
  const setParticipantSpeaking = useVoiceStore((state) => state.setParticipantSpeaking)

  const send = useWebSocketStore((state) => state.send)
  const subscribe = useWebSocketStore((state) => state.subscribe)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioElementsRef = useRef<AudioElementMap>({})
  const iceBufferRef = useRef<RTCIceCandidateInit[]>([])
  const isRemoteSetRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)

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

        // 3. Handle incoming remote tracks (audio playback from SFU)
        pc.ontrack = (event) => {
          console.log('[useSFU] Received remote track from SFU:', event.track.id, event.track.kind)
          if (event.track.kind === 'audio') {
            const trackId = event.track.id
            let audioEl = audioElementsRef.current[trackId]
            if (!audioEl) {
              audioEl = new Audio()
              audioEl.autoplay = true
              audioEl.muted = selfDeafened
              audioElementsRef.current[trackId] = audioEl
            }
            audioEl.srcObject = new MediaStream([event.track])
            audioEl.play().catch((err) => console.log('[useSFU] Audio autoplay notice:', err))
          }
        }

        // 4. Capture microphone stream with standard WebRTC DSP
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          })
        } catch (mediaErr) {
          console.warn('[useSFU] getUserMedia error (fallback to audio transceiver):', mediaErr)
          stream = new MediaStream()
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        localStreamRef.current = stream

        // Apply initial mute state
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !selfMuted
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

    return () => {
      isMounted = false
      cleanup()
    }
  }, [channelId])

  // Subscribe to WebRTC signaling messages from WebSocket
  useEffect(() => {
    const unsubscribe = subscribe(async (msg: WSMessage) => {
      const pc = pcRef.current

      // Handle WebRTC Answer from SFU (initial negotiation response)
      if (msg.type === 'webrtc_answer' && pc) {
        const payload = msg.payload as { sdp?: string }
        if (payload?.sdp) {
          try {
            console.log('[useSFU] Received WebRTC answer from SFU')
            await pc.setRemoteDescription(
              new RTCSessionDescription({
                type: 'answer',
                sdp: payload.sdp,
              })
            )
            isRemoteSetRef.current = true

            // Drain buffered ICE candidates
            for (const candidate of iceBufferRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate))
            }
            iceBufferRef.current = []
          } catch (err) {
            console.error('[useSFU] Error setting remote description for answer:', err)
          }
        }
      }

      // Handle WebRTC Offer from SFU (renegotiation when another user publishes a track)
      if (msg.type === 'webrtc_offer' && pc) {
        const payload = msg.payload as { sdp?: string; channelId?: string }
        if (payload?.sdp) {
          try {
            console.log('[useSFU] Received renegotiation offer from SFU')
            await pc.setRemoteDescription(
              new RTCSessionDescription({
                type: 'offer',
                sdp: payload.sdp,
              })
            )
            isRemoteSetRef.current = true

            // Drain buffered ICE candidates
            for (const candidate of iceBufferRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate))
            }
            iceBufferRef.current = []

            // Create and send answer back to SFU
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
          } catch (err) {
            console.error('[useSFU] Error handling renegotiation offer:', err)
          }
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
      unsubscribe()
    }
  }, [subscribe])

  // Sync mute state with microphone track
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !selfMuted
      })
    }
  }, [selfMuted])

  // Sync deafen state with remote audio elements
  useEffect(() => {
    Object.values(audioElementsRef.current).forEach((audioEl) => {
      audioEl.muted = selfDeafened
    })
  }, [selfDeafened])

  // Setup speaking detection via Web Audio AnalyserNode (100ms, avg > 20)
  function setupSpeakingDetection(stream: MediaStream, activeChanId: string) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let isSpeaking = false

      const checkSpeaking = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return

        analyser.getByteFrequencyData(dataArray)
        const sum = dataArray.reduce((acc, val) => acc + val, 0)
        const avg = sum / dataArray.length

        // Threshold = 20 (as defined in spec-voice.md Section 3.3)
        const currentlySpeaking = avg > 20 && !selfMuted

        if (currentlySpeaking !== isSpeaking) {
          isSpeaking = currentlySpeaking
          setParticipantSpeaking('local', isSpeaking)

          send({
            type: 'speaking',
            channelId: activeChanId,
            payload: {
              channelId: activeChanId,
              speaking: isSpeaking,
            },
          })
        }
      }

      const intervalId = setInterval(checkSpeaking, 100)

      return () => {
        clearInterval(intervalId)
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

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    Object.values(audioElementsRef.current).forEach((audioEl) => {
      audioEl.pause()
      audioEl.srcObject = null
      audioEl.remove()
    })
    audioElementsRef.current = {}
    iceBufferRef.current = []
    isRemoteSetRef.current = false
  }
}

package voice

import (
	"fmt"
	"io"
	"log"
	"sync"

	"github.com/pion/webrtc/v4"
)

// SFUEngine manages WebRTC SFU rooms for voice channels
type SFUEngine struct {
	rooms   map[string]*SFURoom
	mu      sync.RWMutex
	webrtcAPI *webrtc.API
}

// SFURoom represents a voice channel room with connected peers and audio tracks
type SFURoom struct {
	channelID   string
	peers       map[string]*Peer
	tracks      map[string]*webrtc.TrackLocalStaticRTP // key: publisher userID
	sendToUser  BroadcastFunc
	webrtcAPI   *webrtc.API
	mu          sync.RWMutex
}

// Peer represents a connected WebRTC peer in an SFU room
type Peer struct {
	userID          string
	channelID       string
	pc              *webrtc.PeerConnection
	senders         map[string]*webrtc.RTPSender // key: publisher userID
	candidateBuffer []webrtc.ICECandidateInit
	isRemoteDescSet bool
	mu              sync.Mutex
}

// NewSFUEngine creates a new SFU engine instance
func NewSFUEngine() *SFUEngine {
	// Create a MediaEngine and register standard Opus audio codec
	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		log.Printf("[SFU] Error registering default codecs: %v", err)
	}

	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))

	return &SFUEngine{
		rooms:     make(map[string]*SFURoom),
		webrtcAPI: api,
	}
}

// GetOrCreateRoom retrieves or creates a room for a channel
func (e *SFUEngine) GetOrCreateRoom(channelID string, broadcast BroadcastFunc) *SFURoom {
	e.mu.Lock()
	defer e.mu.Unlock()

	room, exists := e.rooms[channelID]
	if !exists {
		room = &SFURoom{
			channelID:  channelID,
			peers:      make(map[string]*Peer),
			tracks:     make(map[string]*webrtc.TrackLocalStaticRTP),
			sendToUser: broadcast,
			webrtcAPI:  e.webrtcAPI,
		}
		e.rooms[channelID] = room
		log.Printf("[SFU] Created room for channel %s", channelID)
	}
	return room
}

// GetRoom retrieves a room if it exists
func (e *SFUEngine) GetRoom(channelID string) *SFURoom {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.rooms[channelID]
}

// RemoveRoom removes a room from the engine
func (e *SFUEngine) RemoveRoom(channelID string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if room, exists := e.rooms[channelID]; exists {
		room.Close()
		delete(e.rooms, channelID)
		log.Printf("[SFU] Removed room for channel %s", channelID)
	}
}

// HandleOffer processes a WebRTC offer from a client and generates an answer
func (r *SFURoom) HandleOffer(userID string, sdp string) (*webrtc.SessionDescription, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Get or create peer
	peer, exists := r.peers[userID]
	if !exists || peer.pc == nil || peer.pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
		config := webrtc.Configuration{
			ICEServers: []webrtc.ICEServer{
				{
					URLs: []string{
						"stun:stun.l.google.com:19302",
						"stun:stun1.l.google.com:19302",
					},
				},
			},
		}

		pc, err := r.webrtcAPI.NewPeerConnection(config)
		if err != nil {
			return nil, fmt.Errorf("failed to create PeerConnection: %w", err)
		}

		peer = &Peer{
			userID:    userID,
			channelID: r.channelID,
			pc:        pc,
			senders:   make(map[string]*webrtc.RTPSender),
		}
		r.peers[userID] = peer

		// Handle ICE candidates from Pion to client
		pc.OnICECandidate(func(candidate *webrtc.ICECandidate) {
			if candidate == nil {
				return
			}
			init := candidate.ToJSON()
			r.sendToUser([]string{userID}, "webrtc_ice", WebRTCICEPayload{
				Candidate:     init.Candidate,
				SDPMid:        *init.SDPMid,
				SDPMLineIndex: int(*init.SDPMLineIndex),
			})
		})

		// Handle incoming audio track from this peer (Publisher)
		pc.OnTrack(func(trackRemote *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
			log.Printf("[SFU] Received incoming track from user %s in channel %s (Kind: %s, ID: %s)",
				userID, r.channelID, trackRemote.Kind().String(), trackRemote.ID())

			if trackRemote.Kind() != webrtc.RTPCodecTypeAudio {
				return
			}

			// Create local track to broadcast to other peers
			localTrack, err := webrtc.NewTrackLocalStaticRTP(
				trackRemote.Codec().RTPCodecCapability,
				fmt.Sprintf("audio-%s", userID),
				fmt.Sprintf("stream-%s", userID),
			)
			if err != nil {
				log.Printf("[SFU] Failed to create local track for user %s: %v", userID, err)
				return
			}

			r.mu.Lock()
			r.tracks[userID] = localTrack
			// Subscribe all other existing peers in the room to this new track and renegotiate
			for otherID, otherPeer := range r.peers {
				if otherID != userID && otherPeer.pc != nil && otherPeer.pc.ConnectionState() != webrtc.PeerConnectionStateClosed {
					r.subscribePeerToTrack(otherPeer, userID, localTrack)
					r.renegotiatePeer(otherPeer)
				}
			}
			r.mu.Unlock()

			// Forward incoming RTP packets from trackRemote to localTrack
			go func() {
				defer func() {
					log.Printf("[SFU] Stopped forwarding track for user %s", userID)
				}()
				for {
					pkt, _, readErr := trackRemote.ReadRTP()
					if readErr != nil {
						if readErr != io.EOF {
							log.Printf("[SFU] ReadRTP error from user %s: %v", userID, readErr)
						}
						return
					}

					if writeErr := localTrack.WriteRTP(pkt); writeErr != nil && writeErr != io.ErrClosedPipe {
						log.Printf("[SFU] WriteRTP error for user %s: %v", userID, writeErr)
						return
					}
				}
			}()
		})

		// Monitor connection state
		pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
			log.Printf("[SFU] Peer %s connection state changed to %s", userID, state.String())
			if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed {
				r.RemovePeer(userID)
			}
		})
	}

	// Subscribe this peer to all other active tracks already present in the room
	for pubID, pubTrack := range r.tracks {
		if pubID != userID {
			r.subscribePeerToTrack(peer, pubID, pubTrack)
		}
	}

	// Set remote offer
	offer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdp,
	}

	if err := peer.pc.SetRemoteDescription(offer); err != nil {
		return nil, fmt.Errorf("failed to set remote description: %w", err)
	}

	peer.mu.Lock()
	peer.isRemoteDescSet = true
	// Drain buffered ICE candidates
	for _, cand := range peer.candidateBuffer {
		if err := peer.pc.AddICECandidate(cand); err != nil {
			log.Printf("[SFU] Error adding buffered ICE candidate for %s: %v", userID, err)
		}
	}
	peer.candidateBuffer = nil
	peer.mu.Unlock()

	// Create and set local answer
	answer, err := peer.pc.CreateAnswer(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create answer: %w", err)
	}

	if err := peer.pc.SetLocalDescription(answer); err != nil {
		return nil, fmt.Errorf("failed to set local description: %w", err)
	}

	log.Printf("[SFU] Generated WebRTC answer for user %s in channel %s", userID, r.channelID)
	return &answer, nil
}

// subscribePeerToTrack attaches a published track to a subscriber peer
func (r *SFURoom) subscribePeerToTrack(peer *Peer, publisherID string, track *webrtc.TrackLocalStaticRTP) {
	if peer == nil || peer.pc == nil {
		return
	}

	peer.mu.Lock()
	defer peer.mu.Unlock()

	if _, alreadySubscribed := peer.senders[publisherID]; alreadySubscribed {
		return
	}

	sender, err := peer.pc.AddTrack(track)
	if err != nil {
		log.Printf("[SFU] Failed to add track from %s to peer %s: %v", publisherID, peer.userID, err)
		return
	}

	peer.senders[publisherID] = sender
	log.Printf("[SFU] Subscribed peer %s to audio track from %s", peer.userID, publisherID)

	// Read incoming RTCP feedback (e.g. PLI/NACK) to prevent buffer overflows
	go func() {
		for {
			if _, _, err := sender.ReadRTCP(); err != nil {
				return
			}
		}
	}()
}

// renegotiatePeer sends an updated WebRTC offer to a subscriber when a new track is added
func (r *SFURoom) renegotiatePeer(peer *Peer) {
	if peer == nil || peer.pc == nil || peer.pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
		return
	}

	peer.mu.Lock()
	defer peer.mu.Unlock()

	offer, err := peer.pc.CreateOffer(nil)
	if err != nil {
		log.Printf("[SFU] Failed to create renegotiation offer for %s: %v", peer.userID, err)
		return
	}

	if err := peer.pc.SetLocalDescription(offer); err != nil {
		log.Printf("[SFU] Failed to set local description for %s: %v", peer.userID, err)
		return
	}

	r.sendToUser([]string{peer.userID}, "webrtc_offer", WebRTCOfferPayload{
		ChannelID: r.channelID,
		SDP:       offer.SDP,
	})
	log.Printf("[SFU] Sent renegotiation offer to peer %s in channel %s", peer.userID, r.channelID)
}

// HandleAnswer processes a WebRTC answer from a client (e.g. following renegotiation)
func (r *SFURoom) HandleAnswer(userID string, sdp string) error {
	r.mu.RLock()
	peer, exists := r.peers[userID]
	r.mu.RUnlock()

	if !exists || peer.pc == nil {
		return fmt.Errorf("peer %s not found in room %s", userID, r.channelID)
	}

	answer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdp,
	}

	if err := peer.pc.SetRemoteDescription(answer); err != nil {
		return fmt.Errorf("failed to set remote description for answer: %w", err)
	}

	log.Printf("[SFU] Successfully applied WebRTC answer from peer %s in channel %s", userID, r.channelID)
	return nil
}

// HandleICE processes an ICE candidate received from a client
func (r *SFURoom) HandleICE(userID string, candidate string, sdpMid string, sdpMLineIndex int) error {
	r.mu.RLock()
	peer, exists := r.peers[userID]
	r.mu.RUnlock()

	if !exists || peer.pc == nil {
		return fmt.Errorf("peer %s not found in room %s", userID, r.channelID)
	}

	mLineIndex := uint16(sdpMLineIndex)
	init := webrtc.ICECandidateInit{
		Candidate:     candidate,
		SDPMid:        &sdpMid,
		SDPMLineIndex: &mLineIndex,
	}

	peer.mu.Lock()
	defer peer.mu.Unlock()

	if !peer.isRemoteDescSet {
		peer.candidateBuffer = append(peer.candidateBuffer, init)
		return nil
	}

	return peer.pc.AddICECandidate(init)
}

// RemovePeer removes a peer from the room and closes their connection
func (r *SFURoom) RemovePeer(userID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	peer, exists := r.peers[userID]
	if !exists {
		return
	}

	delete(r.peers, userID)
	delete(r.tracks, userID)

	if peer.pc != nil {
		_ = peer.pc.Close()
	}

	// Remove this peer's senders from other peers
	for _, otherPeer := range r.peers {
		otherPeer.mu.Lock()
		if sender, ok := otherPeer.senders[userID]; ok {
			_ = otherPeer.pc.RemoveTrack(sender)
			delete(otherPeer.senders, userID)
		}
		otherPeer.mu.Unlock()
	}

	log.Printf("[SFU] User %s left room %s", userID, r.channelID)
}

// Close closes all peer connections in the room
func (r *SFURoom) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, peer := range r.peers {
		if peer.pc != nil {
			_ = peer.pc.Close()
		}
	}
	r.peers = make(map[string]*Peer)
	r.tracks = make(map[string]*webrtc.TrackLocalStaticRTP)
}

// PeerCount returns the count of active peers in the room
func (r *SFURoom) PeerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.peers)
}

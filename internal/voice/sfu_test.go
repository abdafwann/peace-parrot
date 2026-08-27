package voice

import (
	"testing"

	"github.com/pion/webrtc/v4"
)

func TestSFUEngine_Lifecycle(t *testing.T) {
	broadcastCalled := false
	broadcast := func(userIDs []string, eventType string, payload interface{}) {
		broadcastCalled = true
	}

	engine := NewSFUEngine()
	room := engine.GetOrCreateRoom("test-channel-1", broadcast)
	if room == nil {
		t.Fatal("expected room to be created, got nil")
	}

	if engine.GetRoom("test-channel-1") != room {
		t.Fatal("expected GetRoom to return same room instance")
	}

	// Create client peer connection to generate an offer
	clientPC, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatalf("failed to create client PC: %v", err)
	}
	defer clientPC.Close()

	// Add audio transceiver
	_, err = clientPC.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio, webrtc.RTPTransceiverInit{
		Direction: webrtc.RTPTransceiverDirectionSendrecv,
	})
	if err != nil {
		t.Fatalf("failed to add transceiver: %v", err)
	}

	offer, err := clientPC.CreateOffer(nil)
	if err != nil {
		t.Fatalf("failed to create offer: %v", err)
	}

	// Process offer on SFU
	answer, err := room.HandleOffer("user-1", offer.SDP)
	if err != nil {
		t.Fatalf("SFU HandleOffer failed: %v", err)
	}

	if answer == nil || answer.SDP == "" {
		t.Fatal("expected non-empty SDP answer from SFU")
	}

	if room.PeerCount() != 1 {
		t.Fatalf("expected 1 peer, got %d", room.PeerCount())
	}

	// Remove peer
	room.RemovePeer("user-1")
	if room.PeerCount() != 0 {
		t.Fatalf("expected 0 peers after remove, got %d", room.PeerCount())
	}

	// Remove room
	engine.RemoveRoom("test-channel-1")
	if engine.GetRoom("test-channel-1") != nil {
		t.Fatal("expected room to be removed from engine")
	}

	_ = broadcastCalled
}

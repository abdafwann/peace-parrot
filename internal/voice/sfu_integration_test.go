package voice

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

type atomicMuteStatus struct{ muted atomic.Bool }

func (s *atomicMuteStatus) IsUserMuted(string) (bool, error) { return s.muted.Load(), nil }

func TestSFUForwardsAudioOnlyWhileUnmuted(t *testing.T) {
	status := &atomicMuteStatus{}
	h := NewHandler(nil, nil)
	h.SetMuteChecker(status)
	h.SetBanChecker(fixedBanStatus(false))
	candidates := map[string]chan WebRTCICEPayload{"publisher": make(chan WebRTCICEPayload, 100), "listener": make(chan WebRTCICEPayload, 100)}
	room := h.GetSFU().GetOrCreateRoom("room", func(users []string, event string, value interface{}) {
		if event != "webrtc_ice" {
			return
		}
		ice := value.(WebRTCICEPayload)
		for _, user := range users {
			candidates[user] <- ice
		}
	})
	t.Cleanup(room.Close)
	track, err := webrtc.NewTrackLocalStaticRTP(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2}, "mic", "source")
	if err != nil {
		t.Fatal(err)
	}
	received := make(chan uint16, 100)
	connect := func(id string, publish bool) *webrtc.PeerConnection {
		pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = pc.Close() })
		if publish {
			if _, err := pc.AddTrack(track); err != nil {
				t.Fatal(err)
			}
		} else {
			if _, err := pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
				t.Fatal(err)
			}
			pc.OnTrack(func(remote *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
				for {
					packet, _, err := remote.ReadRTP()
					if err != nil {
						return
					}
					received <- packet.SequenceNumber
				}
			})
		}
		offer, err := pc.CreateOffer(nil)
		if err != nil {
			t.Fatal(err)
		}
		gathered := webrtc.GatheringCompletePromise(pc)
		if err := pc.SetLocalDescription(offer); err != nil {
			t.Fatal(err)
		}
		select {
		case <-gathered:
		case <-time.After(5 * time.Second):
			t.Fatal("ICE gathering timed out")
		}
		answer, err := room.HandleOffer(id, pc.LocalDescription().SDP)
		if err != nil {
			t.Fatal(err)
		}
		if err := pc.SetRemoteDescription(*answer); err != nil {
			t.Fatal(err)
		}
		done := make(chan struct{})
		t.Cleanup(func() { close(done) })
		go func() {
			for {
				select {
				case ice := <-candidates[id]:
					mid, index := ice.SDPMid, uint16(ice.SDPMLineIndex)
					_ = pc.AddICECandidate(webrtc.ICECandidateInit{Candidate: ice.Candidate, SDPMid: &mid, SDPMLineIndex: &index})
				case <-done:
					return
				}
			}
		}()
		return pc
	}
	_ = connect("publisher", true)
	write := func(seq uint16) {
		err := track.WriteRTP(&rtp.Packet{Header: rtp.Header{Version: 2, SequenceNumber: seq, Timestamp: uint32(seq) * 960, SSRC: 1234}, Payload: []byte{0xf8, 0xff, 0xfe}})
		if err != nil {
			t.Fatal(err)
		}
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		write(1)
		room.mu.RLock()
		_, ok := room.tracks["publisher"]
		room.mu.RUnlock()
		if ok {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("publisher track did not arrive")
		}
		time.Sleep(20 * time.Millisecond)
	}
	_ = connect("listener", false)
	waitFor := func(seq uint16) {
		t.Helper()
		deadline := time.NewTimer(5 * time.Second)
		defer deadline.Stop()
		ticker := time.NewTicker(20 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				write(seq)
			case got := <-received:
				if got == seq {
					return
				}
			case <-deadline.C:
				t.Fatal(fmt.Sprintf("packet %d not received", seq))
			}
		}
	}
	waitFor(10)
	status.muted.Store(true)
	for i := 0; i < 10; i++ {
		write(20)
		time.Sleep(20 * time.Millisecond)
	}
	for len(received) > 0 {
		if got := <-received; got == 20 {
			t.Fatal("muted audio was forwarded")
		}
	}
	status.muted.Store(false)
	waitFor(30)
}

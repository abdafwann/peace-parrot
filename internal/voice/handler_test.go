package voice

import (
	"io"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/abdafwann/peace-parrot/internal/channel"
	"github.com/pion/rtp"
)

type fixedMuteStatus bool

func (s fixedMuteStatus) IsUserMuted(string) (bool, error) { return bool(s), nil }

type fixedBanStatus bool

func (s fixedBanStatus) IsUserBanned(string) (bool, error) { return bool(s), nil }

type fixedChannelType string

func (c fixedChannelType) GetChannelByID(id string) (*channel.Channel, error) {
	return &channel.Channel{ID: id, Type: string(c)}, nil
}

type changingMuteStatus struct{ muted bool }

func (s *changingMuteStatus) IsUserMuted(string) (bool, error) { return s.muted, nil }

type blockingMuteStatus struct {
	muted   atomic.Bool
	once    sync.Once
	started chan struct{}
	release chan struct{}
}

func (s *blockingMuteStatus) IsUserMuted(string) (bool, error) {
	value := s.muted.Load()
	s.once.Do(func() { close(s.started) })
	<-s.release
	return value, nil
}

func TestSignalingRequiresVoiceMembership(t *testing.T) {
	h := NewHandler(nil, nil)
	tests := []struct {
		name string
		call func() error
	}{
		{"offer", func() error {
			_, err := h.HandleWebRTCOffer("user", []byte(`{"channelId":"room","sdp":"invalid"}`))
			return err
		}},
		{"answer", func() error { return h.HandleWebRTCAnswer("user", []byte(`{"channelId":"room","sdp":"invalid"}`)) }},
		{"ice", func() error { return h.HandleWebRTCICE("user", []byte(`{"channelId":"room","candidate":"invalid"}`)) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.call(); err != ErrUserNotInVoice {
				t.Fatalf("error = %v, want %v", err, ErrUserNotInVoice)
			}
		})
	}
}

func TestVoiceLeaveRequiresMembership(t *testing.T) {
	h := NewHandler(nil, nil)
	if err := h.HandleVoiceLeave("user", []byte(`{"channelId":"not-joined"}`)); err != ErrUserNotInVoice {
		t.Fatalf("error = %v, want %v", err, ErrUserNotInVoice)
	}
}

func TestMutedAudioIsNotForwarded(t *testing.T) {
	status := &changingMuteStatus{}
	h := NewHandler(nil, nil)
	h.SetMuteChecker(status)
	h.SetBanChecker(fixedBanStatus(false))
	readCount := 0
	var forwarded []uint16
	err := forwardAudio(func() (*rtp.Packet, error) {
		readCount++
		if readCount > 3 {
			return nil, io.EOF
		}
		status.muted = readCount == 2
		return &rtp.Packet{Header: rtp.Header{SequenceNumber: uint16(readCount)}}, nil
	}, func(packet *rtp.Packet) error {
		forwarded = append(forwarded, packet.SequenceNumber)
		return nil
	}, func() bool { return h.canForwardAudio("user") })
	if err != io.EOF {
		t.Fatalf("error = %v, want EOF", err)
	}
	if len(forwarded) != 2 || forwarded[0] != 1 || forwarded[1] != 3 {
		t.Fatalf("forwarded = %v, want [1 3]", forwarded)
	}
}

func TestBannedUserCannotForwardVoice(t *testing.T) {
	h := NewHandler(nil, nil)
	h.SetMuteChecker(fixedMuteStatus(false))
	h.SetBanChecker(fixedBanStatus(true))
	if h.canForwardAudio("user") {
		t.Fatal("banned user's audio was allowed")
	}
}

func TestVoiceJoinRestoresAdministratorMute(t *testing.T) {
	h := NewHandler(nil, nil)
	h.SetMuteChecker(fixedMuteStatus(true))
	h.SetBanChecker(fixedBanStatus(false))
	h.SetChannelChecker(fixedChannelType("voice"))
	value, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room"}`))
	if err != nil {
		t.Fatal(err)
	}
	state := value.(VoiceRoomStatePayload)
	if len(state.Participants) != 1 || !state.Participants[0].ServerMuted {
		t.Fatalf("expected administrator mute in snapshot: %+v", state.Participants)
	}
}

func TestVoiceJoinSendsSnapshotToJoiningUser(t *testing.T) {
	var target, event string
	h := NewHandler(func(users []string, kind string, _ interface{}) {
		if len(users) == 1 {
			target, event = users[0], kind
		}
	}, nil)
	h.SetMuteChecker(fixedMuteStatus(false))
	h.SetBanChecker(fixedBanStatus(false))
	h.SetChannelChecker(fixedChannelType("voice"))
	if _, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room"}`)); err != nil {
		t.Fatal(err)
	}
	if target != "user" || event != "voice_room_state" {
		t.Fatalf("target=%q event=%q", target, event)
	}
}

func TestVoiceJoinRejectsTextChannel(t *testing.T) {
	h := NewHandler(nil, nil)
	h.SetMuteChecker(fixedMuteStatus(false))
	h.SetBanChecker(fixedBanStatus(false))
	h.SetChannelChecker(fixedChannelType("text"))
	if _, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"text-room"}`)); err == nil {
		t.Fatal("expected text channel to be rejected")
	}
}

func TestVoiceRejoinRestoresSelfState(t *testing.T) {
	h := NewHandler(nil, nil)
	h.SetMuteChecker(fixedMuteStatus(false))
	h.SetBanChecker(fixedBanStatus(false))
	h.SetChannelChecker(fixedChannelType("voice"))
	if _, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room","selfMuted":true}`)); err != nil {
		t.Fatal(err)
	}
	value, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room","selfMuted":false}`))
	if err != nil {
		t.Fatal(err)
	}
	if value.(VoiceRoomStatePayload).Participants[0].SelfMuted {
		t.Fatal("rejoin retained stale mute state")
	}
}

func TestVoiceRejoinRestoresAdministratorUnmute(t *testing.T) {
	status := &changingMuteStatus{muted: true}
	h := NewHandler(nil, nil)
	h.SetMuteChecker(status)
	h.SetBanChecker(fixedBanStatus(false))
	h.SetChannelChecker(fixedChannelType("voice"))
	if _, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room"}`)); err != nil {
		t.Fatal(err)
	}
	status.muted = false
	value, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room"}`))
	if err != nil {
		t.Fatal(err)
	}
	if value.(VoiceRoomStatePayload).Participants[0].ServerMuted {
		t.Fatal("rejoin retained stale administrator mute")
	}
}

func TestBannedUserCannotJoinVoice(t *testing.T) {
	h := NewHandler(nil, nil)
	h.SetMuteChecker(fixedMuteStatus(false))
	h.SetBanChecker(fixedBanStatus(true))
	h.SetChannelChecker(fixedChannelType("voice"))
	if _, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room"}`)); err == nil {
		t.Fatal("banned user joined voice")
	}
}

func TestAdministratorMuteUpdatesVoiceSnapshots(t *testing.T) {
	h := NewHandler(nil, nil)
	h.manager.Join("room", "user")
	h.SetAdminMute("user", true)
	participant, ok := h.manager.GetParticipant("room", "user")
	if !ok || !participant.ServerMuted {
		t.Fatal("administrator mute missing from voice snapshot")
	}
	h.SetAdminMute("user", false)
	participant, ok = h.manager.GetParticipant("room", "user")
	if !ok || participant.ServerMuted {
		t.Fatal("administrator unmute missing from voice snapshot")
	}
}

func TestMuteDuringVoiceJoinUpdatesSnapshot(t *testing.T) {
	status := &blockingMuteStatus{started: make(chan struct{}), release: make(chan struct{})}
	h := NewHandler(nil, nil)
	h.SetMuteChecker(status)
	h.SetBanChecker(fixedBanStatus(false))
	h.SetChannelChecker(fixedChannelType("voice"))
	joined := make(chan error, 1)
	go func() { _, err := h.HandleVoiceJoin("user", "User", []byte(`{"channelId":"room"}`)); joined <- err }()
	<-status.started
	status.muted.Store(true)
	done := make(chan struct{})
	go func() { h.SetAdminMute("user", true); close(done) }()
	time.Sleep(20 * time.Millisecond)
	close(status.release)
	if err := <-joined; err != nil {
		t.Fatal(err)
	}
	<-done
	participant, ok := h.manager.GetParticipant("room", "user")
	if !ok || !participant.ServerMuted {
		t.Fatal("mute lost during concurrent voice join")
	}
}

func TestSnapshotAndVoiceUpdateAreSerialized(t *testing.T) {
	updates := make(chan struct{}, 1)
	h := NewHandler(nil, func(event string, _ interface{}) {
		if event == "voice_state_update" {
			updates <- struct{}{}
		}
	})
	h.manager.Join("room", "user")
	entered, release := make(chan struct{}), make(chan struct{})
	snapshotDone := make(chan struct{})
	go func() {
		h.SendSnapshots(func(state VoiceRoomStatePayload) {
			if state.Participants[0].SelfMuted {
				t.Error("snapshot should precede mute")
			}
			close(entered)
			<-release
		})
		close(snapshotDone)
	}()
	<-entered
	updateDone := make(chan error, 1)
	go func() {
		updateDone <- h.HandleVoiceStateUpdate("user", []byte(`{"channelId":"room","selfMuted":true}`))
	}()
	select {
	case <-updates:
		t.Fatal("voice update broadcast before snapshot was queued")
	case <-time.After(30 * time.Millisecond):
	}
	close(release)
	<-snapshotDone
	if err := <-updateDone; err != nil {
		t.Fatal(err)
	}
	select {
	case <-updates:
	case <-time.After(time.Second):
		t.Fatal("missing voice update")
	}
}

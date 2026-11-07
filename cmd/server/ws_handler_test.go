package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/internal/channel"
	"github.com/abdafwann/peace-parrot/internal/database"
	"github.com/abdafwann/peace-parrot/internal/message"
	"github.com/abdafwann/peace-parrot/internal/moderation"
	"github.com/abdafwann/peace-parrot/internal/server"
	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/internal/voice"
	"github.com/abdafwann/peace-parrot/internal/websocket"
	dbpkg "github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/golang-jwt/jwt/v5"
	gws "github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type banDuringRegistration struct{ calls atomic.Int32 }

func (b *banDuringRegistration) IsUserBanned(string) (bool, error) {
	if b.calls.Add(1) > 1 {
		time.Sleep(50 * time.Millisecond)
		return true, nil
	}
	return false, nil
}

func TestWebSocketClosesIfBanOccursDuringRegistration(t *testing.T) {
	checker := &banDuringRegistration{}
	manager := auth.NewJWTManager("test-secret-key-12345678901234567890", 1)
	token, err := manager.GenerateToken("user", "user")
	if err != nil {
		t.Fatal(err)
	}
	hub := websocket.NewHub()
	go hub.Run()
	h := NewWebSocketHandler(hub, voice.NewHandler(nil, nil), nil, manager, nil, checker)
	e := echo.New()
	e.GET("/ws", h.HandleWebSocket)
	srv := httptest.NewServer(e)
	defer srv.Close()
	conn, _, err := gws.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?token="+token, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(time.Second))
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
				t.Fatal("connection remained open after ban")
			}
			break
		} else {
			t.Fatal("received private events before ban recheck completed")
		}
	}
	if checker.calls.Load() < 2 {
		t.Fatal("ban was not rechecked after registration")
	}
}

type neverBanned struct{}

func (neverBanned) IsUserBanned(string) (bool, error) { return false, nil }

type voiceChannel struct{}

func (voiceChannel) GetChannelByID(id string) (*channel.Channel, error) {
	kind := "voice"
	if id == "text-room" {
		kind = "text"
	}
	return &channel.Channel{ID: id, Type: kind}, nil
}

type notMuted struct{}

func (notMuted) IsUserMuted(string) (bool, error) { return false, nil }

func TestInvalidVoiceSwitchKeepsCurrentSession(t *testing.T) {
	v := voice.NewHandler(nil, nil)
	v.SetBanChecker(neverBanned{})
	v.SetMuteChecker(notMuted{})
	v.SetChannelChecker(voiceChannel{})
	h := NewWebSocketHandler(nil, v, nil, nil, nil, neverBanned{})
	client := &websocket.Client{ID: "connection", UserID: "user", Username: "user"}
	h.handleMessage(client, &websocket.Message{Type: "voice_join", Payload: json.RawMessage(`{"channelId":"room"}`)})
	h.handleMessage(client, &websocket.Message{Type: "voice_join", Payload: json.RawMessage(`{"channelId":"text-room"}`)})
	if _, ok := v.GetManager().GetParticipant("room", "user"); !ok {
		t.Fatal("invalid switch removed the original voice session")
	}
}

func TestClosingAnotherSocketDoesNotRemoveVoice(t *testing.T) {
	manager := auth.NewJWTManager("test-secret-key-12345678901234567890", 1)
	token, err := manager.GenerateToken("user", "user")
	if err != nil {
		t.Fatal(err)
	}
	hub := websocket.NewHub()
	go hub.Run()
	left := make(chan struct{}, 1)
	v := voice.NewHandler(nil, func(event string, _ interface{}) {
		if event == "user_left_voice" {
			left <- struct{}{}
		}
	})
	v.SetBanChecker(neverBanned{})
	v.SetMuteChecker(notMuted{})
	v.SetChannelChecker(voiceChannel{})
	h := NewWebSocketHandler(hub, v, nil, manager, nil, neverBanned{})
	e := echo.New()
	e.GET("/ws", h.HandleWebSocket)
	srv := httptest.NewServer(e)
	defer srv.Close()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws?token=" + token
	first, _, err := gws.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	second, _, err := gws.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := first.WriteJSON(websocket.Message{Type: "voice_join", Payload: json.RawMessage(`{"channelId":"room"}`)}); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(time.Second)
	for {
		if _, ok := v.GetManager().GetParticipant("room", "user"); ok {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("voice join timed out")
		}
		time.Sleep(time.Millisecond)
	}
	_ = second.Close()
	select {
	case <-left:
		t.Fatal("closing another socket removed voice")
	case <-time.After(250 * time.Millisecond):
	}
	if _, ok := v.GetManager().GetParticipant("room", "user"); !ok {
		t.Fatal("voice participant missing")
	}
}

func TestVoiceSignalingReachesOnlyOwner(t *testing.T) {
	manager := auth.NewJWTManager("test-secret-key-12345678901234567890", 1)
	token, err := manager.GenerateToken("user", "user")
	if err != nil {
		t.Fatal(err)
	}
	hub := websocket.NewHub()
	go hub.Run()
	v := voice.NewHandler(nil, nil)
	v.SetBanChecker(neverBanned{})
	v.SetMuteChecker(notMuted{})
	v.SetChannelChecker(voiceChannel{})
	h := NewWebSocketHandler(hub, v, nil, manager, nil, neverBanned{})
	e := echo.New()
	e.GET("/ws", h.HandleWebSocket)
	srv := httptest.NewServer(e)
	defer srv.Close()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws?token=" + token
	owner, _, err := gws.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.Close()
	other, _, err := gws.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer other.Close()
	if err := owner.WriteJSON(websocket.Message{Type: "voice_join", Payload: json.RawMessage(`{"channelId":"room"}`)}); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(time.Second)
	for {
		h.voiceMu.Lock()
		joined := h.voiceOwners["user"] != ""
		h.voiceMu.Unlock()
		if joined {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("voice join timed out")
		}
		time.Sleep(time.Millisecond)
	}
	h.sendVoiceSignal("user", "webrtc_ice", map[string]string{"candidate": "test"})
	readSignal := func(conn *gws.Conn) bool {
		_ = conn.SetReadDeadline(time.Now().Add(250 * time.Millisecond))
		for {
			var message websocket.Message
			if err := conn.ReadJSON(&message); err != nil {
				return false
			}
			if message.Type == "webrtc_ice" {
				return true
			}
		}
	}
	if !readSignal(owner) {
		t.Fatal("voice owner did not receive signaling")
	}
	if readSignal(other) {
		t.Fatal("non-owner received voice signaling")
	}
}

func TestVoiceSnapshotIsOrderedAfterPriorEvents(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	manager := auth.NewJWTManager("test-secret-key-12345678901234567890", 1)
	token, err := manager.GenerateToken("user", "user")
	if err != nil {
		t.Fatal(err)
	}
	v := voice.NewHandler(nil, nil)
	h := NewWebSocketHandler(hub, v, nil, manager, nil, neverBanned{})
	e := echo.New()
	e.GET("/ws", h.HandleWebSocket)
	srv := httptest.NewServer(e)
	defer srv.Close()
	conn, _, err := gws.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?token="+token, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(time.Second))
	for {
		var msg websocket.Message
		if err := conn.ReadJSON(&msg); err != nil {
			t.Fatal(err)
		}
		if msg.Type == "presence_sync" {
			break
		}
	}
	client := hub.GetClientByUserID("user")
	hub.BroadcastAll("voice_state_update", map[string]bool{"selfMuted": true})
	hub.QueueToClient(client.ID, "voice_room_state", map[string]string{"channelId": "room"})
	var got []string
	for len(got) < 2 {
		var msg websocket.Message
		if err := conn.ReadJSON(&msg); err != nil {
			t.Fatal(err)
		}
		if msg.Type == "voice_state_update" || msg.Type == "voice_room_state" {
			got = append(got, msg.Type)
		}
	}
	if got[0] != "voice_state_update" || got[1] != "voice_room_state" {
		t.Fatalf("out of order: %v", got)
	}
}

func TestWebSocketClosesWhenTokenExpires(t *testing.T) {
	secret := "test-secret-key-12345678901234567890"
	manager := auth.NewJWTManager(secret, 1)
	claims := auth.Claims{UserID: "user", Username: "user", RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Second))}}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	hub := websocket.NewHub()
	go hub.Run()
	h := NewWebSocketHandler(hub, voice.NewHandler(nil, nil), nil, manager, nil, neverBanned{})
	e := echo.New()
	e.GET("/ws", h.HandleWebSocket)
	srv := httptest.NewServer(e)
	defer srv.Close()
	conn, _, err := gws.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?token="+token, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(4 * time.Second))
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
				t.Fatal("expired connection remained open")
			}
			if !gws.IsCloseError(err, gws.ClosePolicyViolation) {
				t.Fatalf("close error = %v, want policy violation", err)
			}
			break
		}
	}
}

func TestMissingMessageEventsAreIgnored(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := database.RunMigrations(dbPath, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	db, err := dbpkg.New(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	h := &WebSocketHandler{messageHandler: message.NewHandler(message.NewStore(db), nil)}
	payload := json.RawMessage(`{"messageId":"missing","content":"hello"}`)

	t.Run("edit", func(t *testing.T) {
		result, err := h.handleMessageEdit("user", payload, "channel")
		if err != nil || result != nil {
			t.Fatalf("got result %v, error %v; want nil, nil", result, err)
		}
	})
	t.Run("delete", func(t *testing.T) {
		result, err := h.handleMessageDelete("user", payload, "channel")
		if err != nil || result != nil {
			t.Fatalf("got result %v, error %v; want nil, nil", result, err)
		}
	})
}

func TestBanDisconnectsActiveWebSocket(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := database.RunMigrations(dbPath, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	db, err := dbpkg.New(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	users := user.NewStore(db)
	admin := &user.User{Username: "admin", PasswordHash: "unused"}
	member := &user.User{Username: "member", PasswordHash: "unused"}
	if err := users.CreateUser(admin); err != nil {
		t.Fatal(err)
	}
	if err := users.CreateUser(member); err != nil {
		t.Fatal(err)
	}
	bans := moderation.NewStore(db)
	manager := auth.NewJWTManager("test-secret-key-12345678901234567890", 1)
	memberToken, _ := manager.GenerateToken(member.ID, member.Username)
	adminToken, _ := manager.GenerateToken(admin.ID, admin.Username)
	hub := websocket.NewHub()
	go hub.Run()
	voiceHandler := voice.NewHandler(nil, nil)
	ws := NewWebSocketHandler(hub, voiceHandler, nil, manager, nil, bans)
	serverHandler := server.NewHandler(nil, users, bans, nil, hub)
	e := echo.New()
	e.GET("/ws", ws.HandleWebSocket)
	e.POST("/ban/:userId", serverHandler.BanUser, auth.JWTMiddleware(manager, bans), auth.RequireAdminMiddleware(users))
	httpServer := httptest.NewServer(e)
	defer httpServer.Close()
	conn, _, err := gws.DefaultDialer.Dial("ws"+strings.TrimPrefix(httpServer.URL, "http")+"/ws?token="+memberToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if err := conn.SetReadDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatal(err)
	}
	if _, _, err := conn.ReadMessage(); err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest(http.MethodPost, httpServer.URL+"/ban/"+member.ID, nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ban status = %d", resp.StatusCode)
	}
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
				t.Fatal("banned user's connection remained open")
			}
			if !gws.IsCloseError(err, gws.ClosePolicyViolation) {
				t.Fatalf("close error = %v, want policy violation", err)
			}
			break
		}
	}
}

func TestWebSocketRejectsBannedUser(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := database.RunMigrations(dbPath, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	db, err := dbpkg.New(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	member := &user.User{Username: "member", PasswordHash: "unused"}
	if err := user.NewStore(db).CreateUser(member); err != nil {
		t.Fatal(err)
	}
	if err := moderation.NewStore(db).BanUser(member.ID, member.ID); err != nil {
		t.Fatal(err)
	}
	manager := auth.NewJWTManager("test-secret-key-12345678901234567890", 1)
	token, err := manager.GenerateToken(member.ID, member.Username)
	if err != nil {
		t.Fatal(err)
	}
	h := NewWebSocketHandler(nil, nil, nil, manager, nil, moderation.NewStore(db))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/ws?token="+token, nil)
	rec := httptest.NewRecorder()
	_ = h.HandleWebSocket(e.NewContext(req, rec))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

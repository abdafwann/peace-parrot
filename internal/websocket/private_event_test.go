package websocket

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	gorilla "github.com/gorilla/websocket"
)

func TestPrivateBlockEventReachesOnlyOwnerSessions(t *testing.T) {
	hub := NewHub()
	upgraded := make(chan *gorilla.Conn, 3)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&gorilla.Upgrader{}).Upgrade(w, r, nil)
		if err == nil {
			upgraded <- conn
		}
	}))
	defer server.Close()
	connect := func(id, owner string) *gorilla.Conn {
		client, _, err := gorilla.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
		if err != nil {
			t.Fatal(err)
		}
		serverConn := <-upgraded
		t.Cleanup(func() { _ = client.Close(); _ = serverConn.Close() })
		session := &Client{ID: id, UserID: owner, Conn: serverConn}
		session.active.Store(true)
		hub.clients[id] = session
		return client
	}
	first := connect("a1", "a")
	second := connect("a2", "a")
	other := connect("b1", "b")
	hub.SendToUser("a", "user_blocks_updated", nil)
	for _, client := range []*gorilla.Conn{first, second} {
		_ = client.SetReadDeadline(time.Now().Add(time.Second))
		var message Message
		if err := client.ReadJSON(&message); err != nil || message.Type != "user_blocks_updated" {
			t.Fatalf("missing private event: %v %v", message, err)
		}
	}
	_ = other.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	if _, _, err := other.ReadMessage(); err == nil {
		t.Fatal("other user received private block event")
	}
}

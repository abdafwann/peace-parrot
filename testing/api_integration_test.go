package testing

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/internal/channel"
	"github.com/abdafwann/peace-parrot/internal/database"
	"github.com/abdafwann/peace-parrot/internal/invite"
	"github.com/abdafwann/peace-parrot/internal/message"
	"github.com/abdafwann/peace-parrot/internal/moderation"
	"github.com/abdafwann/peace-parrot/internal/server"
	"github.com/abdafwann/peace-parrot/internal/upload"
	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/internal/websocket"
	"github.com/abdafwann/peace-parrot/pkg/cloudinary"
	pkgdb "github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/labstack/echo/v4"
)

// setupTestServer boots an ephemeral SQLite database with migrations and configured Echo router
func setupTestServer(t *testing.T) (*echo.Echo, *pkgdb.DB, *auth.JWTManager, func()) {
	t.Helper()

	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_peace_parrot.db")
	uploadsDir := filepath.Join(tempDir, "uploads")
	_ = os.MkdirAll(uploadsDir, 0755)

	migrationsPath := "../migrations"

	// Run migrations
	if err := database.RunMigrations(dbPath, migrationsPath); err != nil {
		t.Fatalf("failed to run migrations: %v", err)
	}

	// Connect to DB
	db, err := pkgdb.New(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	jwtSecret := "test-secret-key-12345678901234567890"
	jwtMgr := auth.NewJWTManager(jwtSecret, 86400)

	hub := websocket.NewHub()
	go hub.Run()

	userStore := user.NewStore(db)
	inviteStore := invite.NewStore(db)
	channelStore := channel.NewStore(db)
	messageStore := message.NewStore(db)
	moderationStore := moderation.NewStore(db)
	serverStore := server.NewStore(db)

	authHandler := auth.NewAuthHandler(userStore, inviteStore, jwtMgr, moderationStore)
	requireAuth := auth.JWTMiddleware(jwtMgr, moderationStore)
	inviteHandler := invite.NewHandler(inviteStore)
	userHandler := user.NewHandler(userStore, nil)
	channelHandler := channel.NewHandler(channelStore)
	messageHandler := message.NewHandler(messageStore, userStore)
	reactionHandler := message.NewReactionHandler(messageStore)
	pinHandler := message.NewPinHandler(messageStore)
	moderationHandler := moderation.NewHandler(moderationStore, hub.DisconnectUser)
	serverHandler := server.NewHandler(serverStore, userStore, moderationStore, nil, hub)
	uploadHandler := upload.NewHandler(nil, uploadsDir)

	e := echo.New()
	e.HideBanner = true

	api := e.Group("/api")

	// Auth
	authGroup := api.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)

	// Invites
	api.GET("/invites/validate/:code", inviteHandler.Validate)
	api.GET("/invites", inviteHandler.List, requireAuth)
	api.POST("/invites", inviteHandler.Create, requireAuth)

	// Users
	api.GET("/users", userHandler.List, requireAuth)
	userHandler.RegisterBlockRoutes(api, requireAuth)
	api.GET("/users/me", userHandler.GetMe, requireAuth)
	api.PATCH("/users/me", userHandler.UpdateMe, requireAuth)

	// Channels
	channels := api.Group("/channels")
	channels.GET("", channelHandler.List, requireAuth)
	channels.POST("", channelHandler.Create, requireAuth, auth.RequireAdminMiddleware(userStore))
	channels.GET("/:id/messages", messageHandler.List, requireAuth)
	channels.POST("/:id/messages", messageHandler.Create, requireAuth)
	channels.GET("/:id/pins", pinHandler.ListPins, requireAuth)
	channels.POST("/:id/pins/:messageId", pinHandler.Pin, requireAuth)
	channels.DELETE("/:id/pins/:messageId", pinHandler.Unpin, requireAuth)

	// Messages
	messages := api.Group("/messages")
	messages.PATCH("/:id", messageHandler.Update, requireAuth)
	messages.DELETE("/:id", messageHandler.Delete, requireAuth)
	messages.POST("/:id/reactions", reactionHandler.AddReaction, requireAuth)
	messages.DELETE("/:id/reactions/:emoji", reactionHandler.RemoveReaction, requireAuth)

	// Uploads
	api.POST("/upload", uploadHandler.UploadFile, requireAuth)
	upload.RegisterPrivateFiles(e, uploadsDir, requireAuth)

	// Server Settings & Roles
	api.GET("/server", serverHandler.GetServerSettings, requireAuth)
	api.GET("/server/roles", serverHandler.ListRoles, requireAuth)
	adminServer := api.Group("/server", requireAuth, auth.RequireAdminMiddleware(userStore))
	adminServer.PATCH("", serverHandler.UpdateServerSettings)
	adminServer.POST("/icon", serverHandler.UploadServerIcon)
	adminServer.POST("/mutes/:userId", serverHandler.MuteUser)
	adminServer.PATCH("/members/:userId/role", serverHandler.UpdateMemberRole)
	adminServer.POST("/roles", serverHandler.CreateRole)
	adminServer.POST("/roles/:id/icon", serverHandler.UploadRoleIcon)
	adminServer.PATCH("/roles/:id", serverHandler.UpdateRole)
	adminServer.DELETE("/roles/:id", serverHandler.DeleteRole)

	// Moderation
	mod := api.Group("/moderation", requireAuth)
	mod.POST("/kick/:userId", moderationHandler.Kick)
	mod.POST("/ban/:userId", moderationHandler.Ban)
	mod.DELETE("/ban/:userId", moderationHandler.Unban)
	mod.POST("/mute/:userId", moderationHandler.Mute)
	mod.DELETE("/mute/:userId", moderationHandler.Unmute)
	mod.GET("/status/:userId", moderationHandler.CheckStatus)

	cleanup := func() {
		_ = db.Close()
		_ = os.RemoveAll(tempDir)
	}

	return e, db, jwtMgr, cleanup
}

func TestUserBlocks(t *testing.T) {
	e, db, jwtMgr, cleanup := setupTestServer(t)
	defer cleanup()
	token, owner := registerHelper(t, e, "blockowner", "Password123!", "Owner", "")
	other := &user.User{Username: "blocktarget", PasswordHash: "unused"}
	if err := user.NewStore(db).CreateUser(other); err != nil {
		t.Fatal(err)
	}
	request := func(method, path, credential string, expected int) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, nil)
		if credential != "" {
			req.Header.Set(echo.HeaderAuthorization, "Bearer "+credential)
		}
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != expected {
			t.Fatalf("%s %s: got %d, want %d: %s", method, path, rec.Code, expected, rec.Body.String())
		}
		return rec
	}
	base := "/api/users/me/blocks"
	request(http.MethodGet, base, "", http.StatusUnauthorized)
	request(http.MethodPut, base+"/"+other.ID, token, http.StatusNoContent)
	request(http.MethodPut, base+"/"+other.ID, token, http.StatusNoContent)
	var ids []string
	if err := json.Unmarshal(request(http.MethodGet, base, token, http.StatusOK).Body.Bytes(), &ids); err != nil {
		t.Fatal(err)
	}
	if len(ids) != 1 || ids[0] != other.ID {
		t.Fatalf("unexpected blocks: %v", ids)
	}
	secondSession, err := jwtMgr.GenerateToken(owner.ID, owner.Username)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(request(http.MethodGet, base, secondSession, http.StatusOK).Body.Bytes(), &ids); err != nil {
		t.Fatal(err)
	}
	if len(ids) != 1 || ids[0] != other.ID {
		t.Fatalf("second session did not see account blocks: %v", ids)
	}
	otherToken, err := jwtMgr.GenerateToken(other.ID, other.Username)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(request(http.MethodGet, base, otherToken, http.StatusOK).Body.Bytes(), &ids); err != nil {
		t.Fatal(err)
	}
	if len(ids) != 0 {
		t.Fatalf("another account saw blocks: %v", ids)
	}
	request(http.MethodPut, base+"/"+owner.ID, token, http.StatusBadRequest)
	request(http.MethodPut, base+"/missing", token, http.StatusNotFound)
	request(http.MethodDelete, base+"/"+other.ID, token, http.StatusNoContent)
	request(http.MethodDelete, base+"/"+other.ID, token, http.StatusNoContent)
}

func TestAdminMuteHasNoAutomaticExpiry(t *testing.T) {
	e, db, jwtMgr, cleanup := setupTestServer(t)
	defer cleanup()
	token, _ := registerHelper(t, e, "owner", "Password123!", "Owner", "")
	for _, tc := range []struct{ route, body, username string }{
		{"/api/server/mutes/", `{"durationMinutes":1}`, "targetone"},
		{"/api/moderation/mute/", `{"duration_minutes":1}`, "targettwo"},
	} {
		t.Run(tc.username, func(t *testing.T) {
			member := &user.User{Username: tc.username, PasswordHash: "unused"}
			if err := user.NewStore(db).CreateUser(member); err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodPost, tc.route+member.ID, strings.NewReader(tc.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
			}
			var expires sql.NullString
			if err := db.QueryRow("SELECT expires_at FROM mutes WHERE user_id = ?", member.ID).Scan(&expires); err != nil {
				t.Fatal(err)
			}
			if expires.Valid {
				t.Fatalf("mute expires at %s", expires.String)
			}
			muted, err := moderation.NewStore(db).IsUserMuted(member.ID)
			if err != nil || !muted {
				t.Fatalf("muted = %v, error = %v", muted, err)
			}
			memberToken, err := jwtMgr.GenerateToken(member.ID, member.Username)
			if err != nil {
				t.Fatal(err)
			}
			message := httptest.NewRequest(http.MethodPost, "/api/channels/1/messages", strings.NewReader(`{"content":"chat remains available"}`))
			message.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			message.Header.Set(echo.HeaderAuthorization, "Bearer "+memberToken)
			result := httptest.NewRecorder()
			e.ServeHTTP(result, message)
			if result.Code != http.StatusCreated {
				t.Fatalf("voice-muted chat status = %d: %s", result.Code, result.Body.String())
			}
		})
	}
}

func TestMuteMigrationPreservesOnlyActiveMutes(t *testing.T) {
	e, db, _, cleanup := setupTestServer(t)
	defer cleanup()
	_, member := registerHelper(t, e, "migrationuser", "Password123!", "User", "")
	for _, item := range []struct {
		id     string
		expiry time.Time
	}{
		{"active", time.Now().UTC().Add(time.Hour)},
		{"expired", time.Now().UTC().Add(-time.Hour)},
	} {
		if _, err := db.Exec("INSERT INTO mutes (id,user_id,muted_by,expires_at) VALUES (?,?,?,?)", item.id, member.ID, member.ID, item.expiry); err != nil {
			t.Fatal(err)
		}
	}
	migration, err := os.ReadFile("../migrations/000019_make_active_mutes_permanent.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(migration)); err != nil {
		t.Fatal(err)
	}
	var active, expired sql.NullString
	if err := db.QueryRow("SELECT expires_at FROM mutes WHERE id='active'").Scan(&active); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow("SELECT expires_at FROM mutes WHERE id='expired'").Scan(&expired); err != nil {
		t.Fatal(err)
	}
	if active.Valid || !expired.Valid {
		t.Fatalf("active=%v expired=%v", active, expired)
	}
}

type testRoundTrip func(*http.Request) (*http.Response, error)

func (f testRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestProfileUploadNeverUsesCloudinary(t *testing.T) {
	e, db, jwtMgr, cleanup := setupTestServer(t)
	defer cleanup()
	token, _ := registerHelper(t, e, "avataruser", "Password123!", "Avatar", "")
	old := http.DefaultTransport
	requests := 0
	http.DefaultTransport = testRoundTrip(func(*http.Request) (*http.Response, error) {
		requests++
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"secure_url":"https://example.com/avatar","public_id":"old"}`))}, nil
	})
	defer func() { http.DefaultTransport = old }()
	cld := cloudinary.NewClient(cloudinary.Config{CloudName: "test", APIKey: "test", APISecret: "test"})
	h := user.NewHandler(user.NewStore(db), cld)
	e.POST("/avatar-test", h.UploadAvatar, auth.JWTMiddleware(jwtMgr, moderation.NewStore(db)))
	e.POST("/banner-test", h.UploadBanner, auth.JWTMiddleware(jwtMgr, moderation.NewStore(db)))
	t.Chdir(t.TempDir())
	for _, category := range []string{"avatar", "banner"} {
		t.Run(category, func(t *testing.T) {
			var body bytes.Buffer
			w := multipart.NewWriter(&body)
			file, err := w.CreateFormFile("file", category+".png")
			if err != nil {
				t.Fatal(err)
			}
			_, _ = file.Write([]byte("test image"))
			_ = w.Close()
			req := httptest.NewRequest(http.MethodPost, "/"+category+"-test", &body)
			req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
			req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if requests != 0 {
				t.Fatalf("made %d external requests", requests)
			}
			if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "/uploads/"+category+"s/") {
				t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestProfileChangesNotifyAfterPersistence(t *testing.T) {
	e, db, jwtMgr, cleanup := setupTestServer(t)
	defer cleanup()
	token, account := registerHelper(t, e, "profileuser", "Password123!", "Before", "")
	store := user.NewStore(db)
	h := user.NewHandler(store, nil)
	var events []user.UserResponse
	h.SetProfileUpdateNotifier(func(profile user.UserResponse) {
		persisted, err := store.GetUserByID(profile.ID)
		if err != nil || persisted.DisplayName != profile.DisplayName || persisted.AvatarURL != profile.AvatarURL || persisted.BannerURL != profile.BannerURL {
			t.Errorf("event does not match persisted profile: %+v, %v", profile, err)
		}
		events = append(events, profile)
	})
	requireAuth := auth.JWTMiddleware(jwtMgr, moderation.NewStore(db))
	e.PATCH("/profile-test", h.UpdateMe, requireAuth)
	e.POST("/avatar-event-test", h.UploadAvatar, requireAuth)
	e.POST("/banner-event-test", h.UploadBanner, requireAuth)
	t.Chdir(t.TempDir())

	invalid := httptest.NewRequest(http.MethodPatch, "/profile-test", strings.NewReader(`{"displayName":`))
	invalid.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	invalid.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	invalidResponse := httptest.NewRecorder()
	e.ServeHTTP(invalidResponse, invalid)
	if invalidResponse.Code != http.StatusBadRequest || len(events) != 0 {
		t.Fatalf("invalid profile status=%d events=%+v", invalidResponse.Code, events)
	}

	req := httptest.NewRequest(http.MethodPatch, "/profile-test", strings.NewReader(`{"displayName":"After"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || len(events) != 1 || events[0].ID != account.ID || events[0].Role != "Admin" || events[0].DisplayName != "After" {
		t.Fatalf("profile status=%d events=%+v body=%s", rec.Code, events, rec.Body.String())
	}
	for i, category := range []string{"avatar", "banner"} {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		file, err := writer.CreateFormFile("file", category+".png")
		if err != nil {
			t.Fatal(err)
		}
		_, _ = file.Write([]byte("test image"))
		_ = writer.Close()
		req := httptest.NewRequest(http.MethodPost, "/"+category+"-event-test", &body)
		req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || len(events) != 2+i {
			t.Fatalf("%s status=%d events=%+v body=%s", category, rec.Code, events, rec.Body.String())
		}
	}
}

func registerHelper(t *testing.T, e *echo.Echo, username, password, displayName, inviteCode string) (string, user.User) {
	t.Helper()
	regBody := map[string]string{
		"username":     username,
		"password":     password,
		"display_name": displayName,
		"invite_code":  inviteCode,
	}
	bodyBytes, _ := json.Marshal(regBody)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("register failed for %s: code %d, body %s", username, rec.Code, rec.Body.String())
	}

	var authResp struct {
		Token string    `json:"token"`
		User  user.User `json:"user"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &authResp)
	return authResp.Token, authResp.User
}

func TestBannedUserCannotLoginOrUseExistingToken(t *testing.T) {
	e, db, _, cleanup := setupTestServer(t)
	defer cleanup()
	token, member := registerHelper(t, e, "banneduser", "Password123!", "Banned User", "")
	store := moderation.NewStore(db)
	if err := store.BanUser(member.ID, member.ID); err != nil {
		t.Fatal(err)
	}

	t.Run("existing token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
		}
	})
	t.Run("login", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"username":"banneduser","password":"Password123!"}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
		}
	})
}

func TestPrivateDataEndpointsRequireAuthentication(t *testing.T) {
	e, _, _, cleanup := setupTestServer(t)
	defer cleanup()
	token, _ := registerHelper(t, e, "reader", "Password123!", "Reader", "")
	for _, path := range []string{
		"/api/users", "/api/channels", "/api/channels/missing/messages",
		"/api/channels/missing/pins", "/api/server", "/api/server/roles",
	} {
		t.Run(path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("unauthenticated status = %d, want 401", rec.Code)
			}
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
			rec = httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Fatalf("authenticated status = %d, want 200: %s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestUploadedFilesRequireAuthentication(t *testing.T) {
	e, db, _, cleanup := setupTestServer(t)
	defer cleanup()
	token, member := registerHelper(t, e, "uploadreader", "Password123!", "Reader", "")
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	file, err := w.CreateFormFile("file", "private.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = file.Write([]byte("private file"))
	_ = w.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/upload", &body)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	uploadRec := httptest.NewRecorder()
	e.ServeHTTP(uploadRec, req)
	if uploadRec.Code != http.StatusOK {
		t.Fatalf("upload status = %d: %s", uploadRec.Code, uploadRec.Body.String())
	}
	var uploaded upload.FileResponse
	if err := json.Unmarshal(uploadRec.Body.Bytes(), &uploaded); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, uploaded.URL, nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated upload status = %d, want 401", rec.Code)
	}
	req = httptest.NewRequest(http.MethodGet, uploaded.URL, nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Body.String() != "private file" {
		t.Fatalf("authenticated status = %d, body = %q", rec.Code, rec.Body.String())
	}
	if err := moderation.NewStore(db).BanUser(member.ID, member.ID); err != nil {
		t.Fatal(err)
	}
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("banned upload status = %d, want 403", rec.Code)
	}
}

func TestIconUploadWorksWithoutCloudinary(t *testing.T) {
	e, _, _, cleanup := setupTestServer(t)
	defer cleanup()
	token, _ := registerHelper(t, e, "owner", "Password123!", "Owner", "")
	t.Chdir(t.TempDir())
	for _, tc := range []struct{ route, category string }{
		{"/api/server/icon", "server"},
		{"/api/server/roles/role-member/icon", "roles"},
	} {
		t.Run(tc.category, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			file, err := writer.CreateFormFile("icon", "icon.png")
			if err != nil {
				t.Fatal(err)
			}
			_, _ = file.Write([]byte("test image"))
			_ = writer.Close()
			req := httptest.NewRequest(http.MethodPost, tc.route, &body)
			req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
			req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), "/uploads/"+tc.category+"/") {
				t.Fatalf("expected local URL: %s", rec.Body.String())
			}
		})
	}
}

func createInviteHelper(t *testing.T, e *echo.Echo, token string, durationHours int) string {
	t.Helper()
	reqBody := map[string]interface{}{
		"durationHours": durationHours,
	}
	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/invites", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("Create invite failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	var inv invite.Invite
	_ = json.Unmarshal(rec.Body.Bytes(), &inv)
	return inv.Code
}

func TestFullAPILifecycle(t *testing.T) {
	e, _, _, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Register first user (should automatically get Admin role without invite code)
	adminToken, adminUser := registerHelper(t, e, "adminuser", "Password123!", "Admin Tester", "")
	if adminUser.Role != "Admin" {
		t.Errorf("Expected role Admin for first user, got %s", adminUser.Role)
	}

	// 2. Login verification
	loginBody := map[string]string{
		"username": "adminuser",
		"password": "Password123!",
	}
	bodyBytes, _ := json.Marshal(loginBody)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Login failed, status: %d, body: %s", rec.Code, rec.Body.String())
	}

	// 3. User Me Profile check and update
	req = httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GetMe failed: %d", rec.Code)
	}

	updateBio := map[string]string{
		"displayName": "Super Admin",
		"bio":         "Automated test runner",
	}
	bodyBytes, _ = json.Marshal(updateBio)
	req = httptest.NewRequest(http.MethodPatch, "/api/users/me", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("UpdateMe failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	// 4. Create Channel
	chanBody := map[string]interface{}{
		"name":  "general-test",
		"type":  "text",
		"topic": "General test channel",
	}
	bodyBytes, _ = json.Marshal(chanBody)
	req = httptest.NewRequest(http.MethodPost, "/api/channels", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("Create Channel failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	var createdChan channel.Channel
	_ = json.Unmarshal(rec.Body.Bytes(), &createdChan)
	if createdChan.ID == "" {
		t.Fatal("Expected created channel to have an ID")
	}

	// 5. Send Message to channel
	msgBody := map[string]interface{}{
		"content": "Hello testing world!",
	}
	bodyBytes, _ = json.Marshal(msgBody)
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/channels/%s/messages", createdChan.ID), bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("Post message failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	var createdMsg message.Message
	_ = json.Unmarshal(rec.Body.Bytes(), &createdMsg)
	if createdMsg.ID == "" || createdMsg.Content != "Hello testing world!" {
		t.Fatalf("Unexpected message: %+v", createdMsg)
	}

	// 6. Add Reaction
	reactBody := map[string]string{"emoji": "🚀"}
	bodyBytes, _ = json.Marshal(reactBody)
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/reactions", createdMsg.ID), bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("Add reaction failed: %d", rec.Code)
	}

	// 7. Pin Message
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/channels/%s/pins/%s", createdChan.ID, createdMsg.ID), nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("Pin message failed: %d", rec.Code)
	}

	// 8. List Pins
	req = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/channels/%s/pins", createdChan.ID), nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("List pins failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	// 9. Update Message
	editBody := map[string]string{"content": "Hello updated world!"}
	bodyBytes, _ = json.Marshal(editBody)
	req = httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/messages/%s", createdMsg.ID), bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Update message failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	// 10. Test Multipart File Upload
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	fw, err := w.CreateFormFile("file", "test-image.png")
	if err != nil {
		t.Fatalf("Failed to create form file: %v", err)
	}
	_, _ = fw.Write([]byte("fake-image-bytes-png-content"))
	_ = w.Close()

	req = httptest.NewRequest(http.MethodPost, "/api/upload", &b)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("Upload file failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	// 11. Delete Message
	req = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/messages/%s", createdMsg.ID), nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Fatalf("Delete message failed: %d", rec.Code)
	}
}

func TestAuthValidationAndErrors(t *testing.T) {
	e, _, _, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. First user registers
	adminToken, _ := registerHelper(t, e, "originaluser", "StrongPass1!", "Original User", "")

	// 2. Second user without invite code -> rejected with 400 INVITE_REQUIRED
	noInviteBody := map[string]string{
		"username": "seconduser",
		"password": "OtherPass123!",
	}
	bodyBytes, _ := json.Marshal(noInviteBody)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for missing invite code, got %d", rec.Code)
	}

	// Generate invite code for second user
	invCode := createInviteHelper(t, e, adminToken, 24)

	// Duplicate username should be rejected with 409
	dupBody := map[string]string{
		"username":    "originaluser",
		"password":    "OtherPass123!",
		"invite_code": invCode,
	}
	bodyBytes, _ = json.Marshal(dupBody)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict && rec.Code != http.StatusBadRequest {
		t.Errorf("Expected duplicate user error (400 or 409), got %d", rec.Code)
	}

	// 3. Login with wrong password should fail with 401
	badLogin := map[string]string{
		"username": "originaluser",
		"password": "WrongPassword!",
	}
	bodyBytes, _ = json.Marshal(badLogin)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for wrong password, got %d", rec.Code)
	}

	// 4. Protected endpoint with invalid JWT should return 401
	req = httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer invalid-junk-token")
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for bad JWT, got %d", rec.Code)
	}
}

func TestReferralInviteCodeSystem(t *testing.T) {
	e, _, _, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. First user registers without invite code
	adminToken, adminUser := registerHelper(t, e, "owner", "OwnerPass123!", "Server Owner", "")
	if adminUser.Role != "Admin" {
		t.Fatalf("Expected owner to be Admin, got %s", adminUser.Role)
	}

	// 2. Non-existent invite validation returns 404
	req := httptest.NewRequest(http.MethodGet, "/api/invites/validate/BOGUS-9999", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("Expected 404 for bogus invite, got %d", rec.Code)
	}

	// 3. Admin generates invite code
	invCode := createInviteHelper(t, e, adminToken, 48)
	if invCode == "" {
		t.Fatal("Expected valid invite code")
	}

	// 4. Validate invite code
	req = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/invites/validate/%s", invCode), nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("Validate invite failed: %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "createdBy") {
		t.Fatal("public invite validation exposed creator identity")
	}

	// 5. Register new member with this invite code
	_, memberUser := registerHelper(t, e, "invitedmember", "MemberPass123!", "Invited Member", invCode)
	if memberUser.Role != "Member" {
		t.Errorf("Expected Member role, got %s", memberUser.Role)
	}

	// 6. Reuse of same invite code must fail with 400 (INVITE_USED)
	reuseBody := map[string]string{
		"username":    "thirduser",
		"password":    "ThirdPass123!",
		"invite_code": invCode,
	}
	bodyBytes, _ := json.Marshal(reuseBody)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request when reusing invite code, got %d", rec.Code)
	}
}

func TestModerationAndRoles(t *testing.T) {
	e, _, _, cleanup := setupTestServer(t)
	defer cleanup()

	// Register admin and regular member
	adminToken, _ := registerHelper(t, e, "adminmod", "AdminPass123!", "Admin Mod", "")
	invCode := createInviteHelper(t, e, adminToken, 24)
	memberToken, memberUser := registerHelper(t, e, "regularmember", "MemberPass123!", "Regular Member", invCode)

	if memberUser.Role != "Member" {
		t.Errorf("Expected Member role for second user, got %s", memberUser.Role)
	}

	// 1. Admin creates custom role
	roleBody := map[string]interface{}{
		"name":        "VIP Gamer",
		"color":       "#ff0055",
		"permissions": 1024,
	}
	bodyBytes, _ := json.Marshal(roleBody)
	req := httptest.NewRequest(http.MethodPost, "/api/server/roles", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("Create Role failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	// 2. Regular member tries to create role -> should be rejected with 403 Forbidden
	req = httptest.NewRequest(http.MethodPost, "/api/server/roles", bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+memberToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden when member tries to create role, got %d", rec.Code)
	}

	// 3. Admin mutes regular member
	muteBody := map[string]interface{}{
		"duration": 3600,
		"reason":   "Spamming text",
	}
	bodyBytes, _ = json.Marshal(muteBody)
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/moderation/mute/%s", memberUser.ID), bytes.NewReader(bodyBytes))
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("Mute user failed: %d, body: %s", rec.Code, rec.Body.String())
	}

	// 4. Admin unmutes member
	req = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/moderation/mute/%s", memberUser.ID), nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+adminToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Fatalf("Unmute user failed: %d, body: %s", rec.Code, rec.Body.String())
	}
}

package testing

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

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

	authHandler := auth.NewAuthHandler(userStore, inviteStore, jwtMgr)
	inviteHandler := invite.NewHandler(inviteStore)
	userHandler := user.NewHandler(userStore, nil)
	channelHandler := channel.NewHandler(channelStore)
	messageHandler := message.NewHandler(messageStore)
	reactionHandler := message.NewReactionHandler(messageStore)
	pinHandler := message.NewPinHandler(messageStore)
	moderationHandler := moderation.NewHandler(moderationStore)
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
	api.GET("/invites", inviteHandler.List, auth.JWTMiddleware(jwtMgr))
	api.POST("/invites", inviteHandler.Create, auth.JWTMiddleware(jwtMgr))

	// Users
	api.GET("/users", userHandler.List)
	api.GET("/users/me", userHandler.GetMe, auth.JWTMiddleware(jwtMgr))
	api.PATCH("/users/me", userHandler.UpdateMe, auth.JWTMiddleware(jwtMgr))

	// Channels
	channels := api.Group("/channels")
	channels.GET("", channelHandler.List)
	channels.POST("", channelHandler.Create, auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	channels.GET("/:id/messages", messageHandler.List)
	channels.POST("/:id/messages", messageHandler.Create, auth.JWTMiddleware(jwtMgr))
	channels.GET("/:id/pins", pinHandler.ListPins)
	channels.POST("/:id/pins/:messageId", pinHandler.Pin, auth.JWTMiddleware(jwtMgr))
	channels.DELETE("/:id/pins/:messageId", pinHandler.Unpin, auth.JWTMiddleware(jwtMgr))

	// Messages
	messages := api.Group("/messages")
	messages.PATCH("/:id", messageHandler.Update, auth.JWTMiddleware(jwtMgr))
	messages.DELETE("/:id", messageHandler.Delete, auth.JWTMiddleware(jwtMgr))
	messages.POST("/:id/reactions", reactionHandler.AddReaction, auth.JWTMiddleware(jwtMgr))
	messages.DELETE("/:id/reactions/:emoji", reactionHandler.RemoveReaction, auth.JWTMiddleware(jwtMgr))

	// Uploads
	api.POST("/upload", uploadHandler.UploadFile, auth.JWTMiddleware(jwtMgr))

	// Server Settings & Roles
	api.GET("/server", serverHandler.GetServerSettings)
	api.GET("/server/roles", serverHandler.ListRoles)
	adminServer := api.Group("/server", auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	adminServer.PATCH("", serverHandler.UpdateServerSettings)
	adminServer.PATCH("/members/:userId/role", serverHandler.UpdateMemberRole)
	adminServer.POST("/roles", serverHandler.CreateRole)
	adminServer.PATCH("/roles/:id", serverHandler.UpdateRole)
	adminServer.DELETE("/roles/:id", serverHandler.DeleteRole)

	// Moderation
	mod := api.Group("/moderation", auth.JWTMiddleware(jwtMgr))
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

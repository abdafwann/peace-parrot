package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/abdafwann/peace-parrot/internal/auth"
	"github.com/abdafwann/peace-parrot/internal/channel"
	"github.com/abdafwann/peace-parrot/internal/database"
	"github.com/abdafwann/peace-parrot/internal/invite"
	"github.com/abdafwann/peace-parrot/internal/message"
	"github.com/abdafwann/peace-parrot/internal/moderation"
	"github.com/abdafwann/peace-parrot/internal/server"
	"github.com/abdafwann/peace-parrot/internal/soundboard"
	"github.com/abdafwann/peace-parrot/internal/upload"
	"github.com/abdafwann/peace-parrot/internal/user"
	"github.com/abdafwann/peace-parrot/internal/voice"
	"github.com/abdafwann/peace-parrot/internal/websocket"
	"github.com/abdafwann/peace-parrot/pkg/cloudinary"
	"github.com/abdafwann/peace-parrot/pkg/config"
	dbpkg "github.com/abdafwann/peace-parrot/pkg/database"
	"github.com/abdafwann/peace-parrot/pkg/middleware"
	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Run migrations
	log.Println("Running database migrations...")
	if err := database.RunMigrations(cfg.Database.Path, cfg.Database.MigrationsDir); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migrations complete!")

	// Initialize database connection
	db, err := dbpkg.New(cfg.Database.Path)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connected!")

	// Initialize JWT manager
	jwtMgr := auth.NewJWTManager(cfg.JWT.Secret, cfg.JWT.Expiry)

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()
	log.Println("WebSocket hub started")

	// Initialize stores and handlers
	userStore := user.NewStore(db)
	inviteStore := invite.NewStore(db)
	inviteHandler := invite.NewHandler(inviteStore)
	authHandler := auth.NewAuthHandler(userStore, inviteStore, jwtMgr)

	// Channel handler
	channelStore := channel.NewStore(db)
	channelHandler := channel.NewHandler(channelStore)

	// Message handler
	messageStore := message.NewStore(db)
	messageHandler := message.NewHandler(messageStore, userStore)
	reactionHandler := message.NewReactionHandler(messageStore)
	pinHandler := message.NewPinHandler(messageStore)

	// Moderation handler
	moderationStore := moderation.NewStore(db)
	moderationHandler := moderation.NewHandler(moderationStore)

	// Cloudinary client
	cld := cloudinary.NewClient(cloudinary.Config{
		CloudName: cfg.Cloudinary.CloudName,
		APIKey:    cfg.Cloudinary.APIKey,
		APISecret: cfg.Cloudinary.APISecret,
	})

	// User handler
	userHandler := user.NewHandler(userStore, cld)

	// Server settings handler
	serverStore := server.NewStore(db)
	serverHandler := server.NewHandler(serverStore, userStore, moderationStore, cld, hub)

	// Soundboard handler
	soundboardStore := soundboard.NewStore(db)
	soundboardHandler := soundboard.NewHandler(soundboardStore, hub)

	// Voice handler - needs broadcast function from hub
	voiceHandler := voice.NewHandler(
		func(userIDs []string, eventType string, payload interface{}) {
			for _, userID := range userIDs {
				hub.SendToUser(userID, eventType, payload)
			}
		},
		func(eventType string, payload interface{}) {
			hub.BroadcastAll(eventType, payload)
		},
	)

	// Create Echo instance
	e := echo.New()
	e.HideBanner = true

	// Global middleware
	e.Use(middleware.PanicRecoveryMiddleware)
	e.Use(echomiddleware.Recover())
	e.Use(middleware.RequestLoggerMiddleware)
	e.Use(middleware.CORSMiddleware())

	// Health check endpoint
	e.GET("/health", healthCheck(db))

	// WebSocket endpoint
	wsHandler := NewWebSocketHandler(hub, voiceHandler, messageHandler, jwtMgr)
	e.GET("/ws", wsHandler.HandleWebSocket)

	// API routes
	api := e.Group("/api")

	// Server settings routes (public view, admin protected updates)
	api.GET("/server", serverHandler.GetServerSettings)
	api.GET("/server/roles", serverHandler.ListRoles)

	// Admin protected server routes
	adminServer := api.Group("/server", auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	adminServer.PATCH("", serverHandler.UpdateServerSettings)
	adminServer.POST("/icon", serverHandler.UploadServerIcon)
	adminServer.GET("/bans", serverHandler.ListBans)
	adminServer.POST("/bans/:userId", serverHandler.BanUser)
	adminServer.DELETE("/bans/:userId", serverHandler.UnbanUser)
	adminServer.POST("/kicks/:userId", serverHandler.KickUser)
	adminServer.POST("/mutes/:userId", serverHandler.MuteUser)
	adminServer.DELETE("/mutes/:userId", serverHandler.UnmuteUser)
	adminServer.PATCH("/members/:userId/role", serverHandler.UpdateMemberRole)
	adminServer.POST("/roles", serverHandler.CreateRole)
	adminServer.PATCH("/roles/:id", serverHandler.UpdateRole)
	adminServer.POST("/roles/:id/icon", serverHandler.UploadRoleIcon)
	adminServer.DELETE("/roles/:id", serverHandler.DeleteRole)

	// Users routes
	api.GET("/users", userHandler.List)
	api.GET("/users/me", userHandler.GetMe, auth.JWTMiddleware(jwtMgr))
	api.PATCH("/users/me", userHandler.UpdateMe, auth.JWTMiddleware(jwtMgr))
	api.POST("/users/me/avatar", userHandler.UploadAvatar, auth.JWTMiddleware(jwtMgr))
	api.POST("/users/me/banner", userHandler.UploadBanner, auth.JWTMiddleware(jwtMgr))

	// Auth routes (public)
	authGroup := api.Group("/auth")
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/register", authHandler.Register)

	// Invites routes
	api.GET("/invites/validate/:code", inviteHandler.Validate)
	api.GET("/invites", inviteHandler.List, auth.JWTMiddleware(jwtMgr))
	api.POST("/invites", inviteHandler.Create, auth.JWTMiddleware(jwtMgr))

	// Channel routes
	channels := api.Group("/channels")
	channels.GET("", channelHandler.List)
	channels.POST("", channelHandler.Create, auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	channels.PATCH("/reorder", channelHandler.Reorder, auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	channels.POST("/reorder", channelHandler.Reorder, auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	channels.GET("/:id", channelHandler.Get)
	channels.PATCH("/:id", channelHandler.Update, auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	channels.DELETE("/:id", channelHandler.Delete, auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))

	// Message routes
	channels.GET("/:id/messages", messageHandler.List)
	channels.POST("/:id/messages", messageHandler.Create, auth.JWTMiddleware(jwtMgr))

	// Pin routes
	channels.GET("/:id/pins", pinHandler.ListPins)
	channels.POST("/:id/pins/:messageId", pinHandler.Pin, auth.JWTMiddleware(jwtMgr))
	channels.DELETE("/:id/pins/:messageId", pinHandler.Unpin, auth.JWTMiddleware(jwtMgr))

	// Message CRUD routes
	messages := api.Group("/messages")
	messages.Use(auth.JWTMiddleware(jwtMgr))
	messages.PATCH("/:id", messageHandler.Update)
	messages.DELETE("/:id", messageHandler.Delete)
	messages.GET("/search", messageHandler.Search)

	// Reaction routes
	messages.POST("/:id/reactions", reactionHandler.AddReaction)
	messages.DELETE("/:id/reactions/:emoji", reactionHandler.RemoveReaction)
	messages.GET("/:id/reactions", reactionHandler.GetReactions)

	// Moderation routes
	mod := api.Group("/moderation")
	mod.Use(auth.JWTMiddleware(jwtMgr), auth.RequireAdminMiddleware(userStore))
	mod.POST("/kick/:userId", moderationHandler.Kick)
	mod.POST("/ban/:userId", moderationHandler.Ban)
	mod.DELETE("/ban/:userId", moderationHandler.Unban)
	mod.POST("/mute/:userId", moderationHandler.Mute)
	mod.DELETE("/mute/:userId", moderationHandler.Unmute)
	mod.GET("/status/:userId", moderationHandler.CheckStatus)

	// Soundboard routes
	api.GET("/soundboard", soundboardHandler.List)
	api.POST("/soundboard", soundboardHandler.Create, auth.JWTMiddleware(jwtMgr))
	api.DELETE("/soundboard/:id", soundboardHandler.Delete, auth.JWTMiddleware(jwtMgr))

	// File / Media upload routes
	uploadHandler := upload.NewHandler(cld, "uploads")
	api.POST("/upload", uploadHandler.UploadFile, auth.JWTMiddleware(jwtMgr))
	e.Static("/uploads", "uploads")

	// Serve frontend SPA web assets if present
	if _, err := os.Stat("web/dist"); err == nil {
		e.Static("/assets", "web/dist/assets")
		e.GET("/*", func(c echo.Context) error {
			path := c.Request().URL.Path
			// Do not intercept API, WebSocket, or Uploads endpoints
			if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") || strings.HasPrefix(path, "/uploads") {
				return echo.ErrNotFound
			}
			// If physical file exists in web/dist, serve it (e.g. favicon, manifest, etc.)
			filePath := filepath.Join("web/dist", filepath.Clean(path))
			if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
				return c.File(filePath)
			}
			// Otherwise fallback to index.html for SPA client-side routing
			return c.File("web/dist/index.html")
		})
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	go func() {
		log.Printf("Starting PeaceParrot server on %s", addr)
		if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server stopped")
}

// healthCheck returns server health status
func healthCheck(db *dbpkg.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		// Check database connectivity
		if err := db.Ping(); err != nil {
			return middleware.WriteError(c, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Database connection failed", nil)
		}

		return c.JSON(http.StatusOK, map[string]string{
			"status": "healthy",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	}
}

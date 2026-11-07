package testing

import (
	"path/filepath"
	"testing"

	"github.com/abdafwann/peace-parrot/internal/database"
	"github.com/abdafwann/peace-parrot/internal/moderation"
	"github.com/abdafwann/peace-parrot/internal/user"
	pkgdb "github.com/abdafwann/peace-parrot/pkg/database"
)

func TestVoiceAccessTracksModerationChanges(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	if err := database.RunMigrations(path, "../migrations"); err != nil {
		t.Fatal(err)
	}
	db, err := pkgdb.New(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	u := &user.User{Username: "member", PasswordHash: "unused"}
	if err := user.NewStore(db).CreateUser(u); err != nil {
		t.Fatal(err)
	}
	store := moderation.NewStore(db)
	check := func(want bool) {
		t.Helper()
		got, err := store.VoiceAllowed(u.ID)
		if err != nil || got != want {
			t.Fatalf("allowed=%v, err=%v; want %v", got, err, want)
		}
	}
	check(true)
	if err := store.MuteUser(u.ID, u.ID, 0); err != nil {
		t.Fatal(err)
	}
	check(false)
	if err := store.UnmuteUser(u.ID); err != nil {
		t.Fatal(err)
	}
	check(true)
	if err := store.BanUser(u.ID, u.ID); err != nil {
		t.Fatal(err)
	}
	check(false)
	if err := store.UnbanUser(u.ID); err != nil {
		t.Fatal(err)
	}
	check(true)
}

func TestVoiceAccessDeniesWhenDatabaseUnavailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	if err := database.RunMigrations(path, "../migrations"); err != nil {
		t.Fatal(err)
	}
	db, err := pkgdb.New(path)
	if err != nil {
		t.Fatal(err)
	}
	store := moderation.NewStore(db)
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	allowed, err := store.VoiceAllowed("user")
	if err == nil || allowed {
		t.Fatalf("allowed=%v err=%v; want denied with error", allowed, err)
	}
}

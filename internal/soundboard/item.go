package soundboard

import "time"

type SoundboardItem struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Emoji     string    `json:"emoji"`
	Category  string    `json:"category"`
	Duration  string    `json:"duration"`
	CustomURL string    `json:"customUrl"`
	CreatedBy *string   `json:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateSoundboardItemRequest struct {
	Name      string `json:"name"`
	Emoji     string `json:"emoji"`
	Duration  string `json:"duration"`
	CustomURL string `json:"customUrl"`
}

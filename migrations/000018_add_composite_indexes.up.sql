CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mutes_user_expires ON mutes(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_reactions_msg_emoji ON reactions(message_id, emoji);

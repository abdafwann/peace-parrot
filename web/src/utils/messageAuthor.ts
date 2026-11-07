interface MessageAuthorMetadata {
  authorName?: string
  authorAvatarUrl?: string
}

interface CurrentProfile {
  username: string
  displayName?: string
  avatarUrl?: string
}

export function resolveMessageAuthor(message: MessageAuthorMetadata, profile?: CurrentProfile | null) {
  if (profile) return { name: profile.displayName || profile.username, avatarUrl: profile.avatarUrl || undefined }
  return { name: message.authorName || 'User', avatarUrl: message.authorAvatarUrl || undefined }
}

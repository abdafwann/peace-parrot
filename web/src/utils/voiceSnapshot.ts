export function clearChannelParticipants<T extends { channelId?: string }>(current: Map<string, T>, channelId: string): Map<string, T> {
  const result = new Map(current)
  for (const [id, participant] of result) {
    if (participant.channelId === channelId) result.delete(id)
  }
  return result
}

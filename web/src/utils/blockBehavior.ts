export function visibleMessages<T extends { authorId?: string }>(messages: T[], blocked: ReadonlySet<string>, loaded = true): T[] {
  return loaded ? messages.filter((message) => !message.authorId || !blocked.has(message.authorId)) : []
}

export function remoteUserGain(blocked: boolean, localMuted: boolean, deafened: boolean, userVolume: number, masterVolume: number, loaded = true): number {
  return !loaded || blocked || localMuted || deafened ? 0 : userVolume * masterVolume
}

export function createBlockSession() {
  let token: string | null = null
  let revision = 0
  return {
    reset(next: string | null) { token = next; revision++ },
    async load(next: string, request: () => Promise<string[]>): Promise<string[] | undefined> {
      if (token !== next) { token = next; revision++ }
      const requestRevision = ++revision
      try {
        const result = await request()
        return token === next && revision === requestRevision ? result : undefined
      } catch (error) {
        if (token !== next || revision !== requestRevision) return undefined
        throw error
      }
    },
  }
}

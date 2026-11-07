export function probeServerHealth(baseUrl: string, signal: AbortSignal): Promise<Response> {
  return fetch(`${baseUrl}/health`, { signal, cache: 'no-store' })
}

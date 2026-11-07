export function localUploadPath(value: string, baseUrl: string): string | null {
  try {
    if (value.startsWith('//')) return null
    const base = new URL(baseUrl)
    const resolved = new URL(value, base)
    const legacyLocal = resolved.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(resolved.hostname) && resolved.port === '8080'
    if ((resolved.origin !== base.origin && !legacyLocal) || !resolved.pathname.startsWith('/uploads/')) return null
    return resolved.pathname + resolved.search
  } catch {
    return null
  }
}

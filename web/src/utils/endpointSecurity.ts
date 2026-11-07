export function isSecureServerURL(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return false
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}

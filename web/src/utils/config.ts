// Global API & WebSocket Endpoint Configuration with Auto-Fallback

const DEFAULT_LOCAL_URL = 'http://localhost:8080'

const getInitialApiBaseUrl = (): string => {
  // 1. Check custom saved server URL in localStorage
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('peaceparrot_custom_api_url')
      if (saved && saved.trim() !== '') {
        return saved.trim().replace(/\/+$/, '')
      }
    } catch {}
  }

  // 2. Check Vite environment variable
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '')
  }

  // 3. Check if running in browser with non-tauri / non-localhost origin
  if (
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('tauri://')
  ) {
    return window.location.origin.replace(/\/+$/, '')
  }

  // 4. Fallback to default local dev server
  return DEFAULT_LOCAL_URL
}

export let API_BASE_URL = getInitialApiBaseUrl()

export const getWsUrl = (): string => {
  const envWs = import.meta.env.VITE_WS_URL
  if (envWs && typeof envWs === 'string' && envWs.trim() !== '') {
    // If API_BASE_URL was auto-switched to localhost, WS should also use localhost
    if (API_BASE_URL.includes('localhost:8080') || API_BASE_URL.includes('127.0.0.1:8080')) {
      return 'ws://localhost:8080/ws'
    }
    return envWs
  }

  const httpUrl = API_BASE_URL
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://') + '/ws'
  }
  if (httpUrl.startsWith('http://')) {
    return httpUrl.replace('http://', 'ws://') + '/ws'
  }

  return 'ws://localhost:8080/ws'
}

export let WS_BASE_URL = getWsUrl()

export function setApiBaseUrl(newUrl: string) {
  API_BASE_URL = newUrl.replace(/\/+$/, '')
  WS_BASE_URL = getWsUrl()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('api-base-url-changed', {
        detail: { url: API_BASE_URL, wsUrl: WS_BASE_URL },
      })
    )
  }
}

// Auto-discovery & Fallback probe
export async function probeAndAutoFallbackEndpoint(): Promise<string> {
  const primary = API_BASE_URL

  // If already pointing to localhost, verify if it's healthy
  if (primary.includes('localhost:8080') || primary.includes('127.0.0.1:8080')) {
    return primary
  }

  // 1. Probe primary endpoint (e.g. trycloudflare tunnel or custom remote domain)
  let isPrimaryAlive = false
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)

    const res = await fetch(`${primary}/health`, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      isPrimaryAlive = true
      console.log(`[Config] Primary backend (${primary}) is active and reachable.`)
      return primary
    }
  } catch (err) {
    console.warn(`[Config] Primary backend (${primary}) is unreachable:`, err)
  }

  // 2. If primary is down, probe localhost:8080 fallback
  if (!isPrimaryAlive) {
    try {
      const localController = new AbortController()
      const localTimeout = setTimeout(() => localController.abort(), 1500)

      const localRes = await fetch(`${DEFAULT_LOCAL_URL}/health`, {
        signal: localController.signal,
        headers: { 'Cache-Control': 'no-cache' },
      })
      clearTimeout(localTimeout)

      if (localRes.ok) {
        console.log(`[Config] 🔄 Primary tunnel down. Auto-switched to localhost fallback (${DEFAULT_LOCAL_URL})`)
        setApiBaseUrl(DEFAULT_LOCAL_URL)
        return DEFAULT_LOCAL_URL
      }
    } catch (localErr) {
      console.warn(`[Config] Local backend fallback also unreachable:`, localErr)
    }
  }

  return primary
}

// Automatically trigger probe in background on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    probeAndAutoFallbackEndpoint().catch(() => {})
  }, 150)
}

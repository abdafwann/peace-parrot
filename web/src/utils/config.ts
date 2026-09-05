// Global API & WebSocket Endpoint Configuration with Intelligent Auto-Fallback

export const APP_VERSION = '1.0.1'
export const DEFAULT_LOCAL_URL = 'http://localhost:8080'

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

export function getApiBaseUrl(): string {
  return API_BASE_URL
}

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

export function setApiBaseUrl(newUrl: string, persistToStorage = false) {
  const clean = newUrl.trim().replace(/\/+$/, '')
  API_BASE_URL = clean
  WS_BASE_URL = getWsUrl()

  if (typeof window !== 'undefined') {
    if (persistToStorage) {
      try {
        localStorage.setItem('peaceparrot_custom_api_url', clean)
      } catch {}
    }
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
    const timeoutId = setTimeout(() => controller.abort(), 1800)

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
      const localTimeout = setTimeout(() => localController.abort(), 1200)

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

/**
 * Resilient fetch wrapper:
 * If the configured Cloudflare tunnel / remote endpoint fails (network error, timeout, or 502/503/504/530),
 * it seamlessly and automatically falls back to localhost:8080 and retries the request!
 */
export async function apiFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const resolveUrl = (baseUrl: string) => {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl
    }
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
    return `${baseUrl}${cleanPath}`
  }

  const primaryUrl = resolveUrl(API_BASE_URL)
  const isRemote = !primaryUrl.includes('localhost:8080') && !primaryUrl.includes('127.0.0.1:8080')

  // If calling remote tunnel without a custom signal, use a 2s timeout for fast fallback
  let timeoutId: any = null
  let requestInit = init
  if (isRemote && !init?.signal) {
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 2200)
    requestInit = { ...init, signal: controller.signal }
  }

  try {
    const res = await fetch(primaryUrl, requestInit)
    if (timeoutId) clearTimeout(timeoutId)

    // Check for Cloudflare tunnel downtime error codes (502, 503, 504, 530)
    if (!res.ok && [502, 503, 504, 530].includes(res.status) && isRemote) {
      console.warn(`[Config] Remote request returned ${res.status}. Falling back to ${DEFAULT_LOCAL_URL}`)
      setApiBaseUrl(DEFAULT_LOCAL_URL)
      const fallbackUrl = resolveUrl(DEFAULT_LOCAL_URL)
      return await fetch(fallbackUrl, init)
    }

    return res
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)

    // Network / DNS / Connection refused / Timeout error on remote tunnel
    if (isRemote) {
      console.warn(`[Config] Network error requesting ${primaryUrl}. Auto-falling back to ${DEFAULT_LOCAL_URL}:`, err)
      setApiBaseUrl(DEFAULT_LOCAL_URL)
      const fallbackUrl = resolveUrl(DEFAULT_LOCAL_URL)
      return await fetch(fallbackUrl, init)
    }
    throw err
  }
}

// Automatically trigger probe in background on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    probeAndAutoFallbackEndpoint().catch(() => {})
  }, 100)
}

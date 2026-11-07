// Global API & WebSocket endpoint configuration
import { useAuthStore } from '../stores/authStore'
import { authenticatedRequestInit, shouldClearSession } from './authHeaders'
import { isSecureServerURL } from './endpointSecurity'
import { isCurrentSession } from './sessionGuard'
import { probeServerHealth } from './serverHealth'

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
  const httpUrl = API_BASE_URL
  if (!isSecureServerURL(httpUrl)) return ''
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
  if (!isSecureServerURL(clean)) throw new Error('Use HTTPS for remote servers; HTTP is only allowed on localhost.')
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

// Probe the configured backend without switching server identity.
export async function probeAndAutoFallbackEndpoint(): Promise<string> {
  const primary = API_BASE_URL

  // If already pointing to localhost, verify if it's healthy
  if (primary.includes('localhost:8080') || primary.includes('127.0.0.1:8080')) {
    return primary
  }

  // 1. Probe primary endpoint (e.g. trycloudflare tunnel or custom remote domain)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1800)

    const res = await probeServerHealth(primary, controller.signal)
    clearTimeout(timeoutId)

    if (res.ok) {
      console.log(`[Config] Primary backend (${primary}) is active and reachable.`)
      return primary
    }
  } catch (err) {
    console.warn(`[Config] Primary backend (${primary}) is unreachable:`, err)
  }

  // A failed probe must not silently switch the user's server or credentials.
  return primary
}

/**
 * Fetch from the selected server without silently replaying requests to another server.
 */
export async function apiFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  if (!isSecureServerURL(API_BASE_URL)) throw new Error('Use HTTPS for remote servers; HTTP is only allowed on localhost.')
  const sessionToken = useAuthStore.getState().token
  init = authenticatedRequestInit(pathOrUrl, init, sessionToken)
  const authorization = new Headers(init?.headers).get('Authorization')
  if (pathOrUrl.startsWith('/api/') && authorization && authorization !== `Bearer ${sessionToken}`) {
    throw new Error('Request belongs to a different session')
  }
  if (new Headers(init?.headers).has('Authorization')) {
    init = { ...init, redirect: 'error' }
  }
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

    if (pathOrUrl.startsWith('/api/') && authorization && sessionToken && !isCurrentSession(sessionToken, useAuthStore.getState().token)) {
      throw new Error('Request belongs to a different session')
    }

    if (sessionToken && pathOrUrl.startsWith('/api/') && new Headers(init?.headers).has('Authorization')) {
      let code: string | undefined
      if (res.status === 403) {
        const body = await res.clone().json().catch(() => null)
        code = body?.error?.code
      }
      if (shouldClearSession(res.status, code) && useAuthStore.getState().token === sessionToken) {
        useAuthStore.getState().logout()
      }
    }

    return res
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    throw err
  }
}

export function getOptimizedImageUrl(url?: string, width: number = 80, height: number = 80): string {
  if (!url) return ''
  if (!url.includes('cloudinary.com') || !url.includes('/upload/')) {
    return url
  }
  return url.replace('/upload/', `/upload/c_fill,w_${width},h_${height},f_auto,q_auto/`)
}

if (typeof window !== 'undefined') {
  probeAndAutoFallbackEndpoint().catch(() => {})
}

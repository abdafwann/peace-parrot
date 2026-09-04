// Global API & WebSocket Endpoint Configuration

const getApiBaseUrl = (): string => {
  // 1. Check Vite environment variable
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '')
  }

  // 2. Check if running in browser with non-tauri / non-localhost origin
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('tauri://')) {
    return window.location.origin.replace(/\/+$/, '')
  }

  // 3. Fallback to default local dev server
  return 'http://localhost:8080'
}

export const API_BASE_URL = getApiBaseUrl()

export const getWsUrl = (): string => {
  const envWs = import.meta.env.VITE_WS_URL
  if (envWs && typeof envWs === 'string' && envWs.trim() !== '') {
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

export const WS_BASE_URL = getWsUrl()

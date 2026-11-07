import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { getApiBaseUrl } from '../utils/config'
import { localUploadPath } from '../utils/privateMediaPath'
import { isSecureServerURL } from '../utils/endpointSecurity'

export function usePrivateMedia(url?: string): string | undefined {
  const token = useAuthStore((state) => state.token)
  const [loaded, setLoaded] = useState<{ path: string; token: string; url: string }>()
  const path = url ? localUploadPath(url, getApiBaseUrl()) : null

  useEffect(() => {
    setLoaded(undefined)
    if (!path || !token || !isSecureServerURL(getApiBaseUrl())) return

    const controller = new AbortController()
    let object: string | undefined
    fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
    }).then((response) => {
      if (!response.ok) throw new Error(`Media request failed: ${response.status}`)
      return response.blob()
    }).then((blob) => {
      if (!controller.signal.aborted) {
        object = URL.createObjectURL(blob)
        setLoaded({ path, token, url: object })
      }
    }).catch((error) => {
      if (!controller.signal.aborted) console.error('Failed to load private media', error)
    })

    return () => {
      controller.abort()
      if (object) URL.revokeObjectURL(object)
    }
  }, [path, token])

  return path ? (loaded?.path === path && loaded.token === token ? loaded.url : undefined) : url
}

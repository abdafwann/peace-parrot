export function authenticatedRequestInit(path: string, init: RequestInit | undefined, token: string | null): RequestInit | undefined {
  if (!path.startsWith('/api/')) {
    return init
  }
  const safeInit: RequestInit = { ...init, redirect: 'error' }
  if (!token || path.startsWith('/api/auth/') || path.startsWith('/api/invites/validate/')) return safeInit
  const headers = new Headers(init?.headers)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return { ...safeInit, headers }
}

export function shouldClearSession(status: number, code: string | undefined): boolean {
  return status === 401 || (status === 403 && code === 'USER_BANNED')
}

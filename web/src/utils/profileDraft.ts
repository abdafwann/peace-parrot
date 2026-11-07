import type { RawUserData } from '../stores/authStore'

interface ProfileDraft {
  displayName: string
  bio: string
  avatarUrl: string
  bannerUrl: string
  avatarFile?: File | null
  bannerFile?: File | null
}

type Request = (path: string, init?: RequestInit) => Promise<Response>

export async function saveProfileDraft(draft: ProfileDraft, request: Request, signal?: AbortSignal): Promise<RawUserData> {
  async function upload(file: File): Promise<string> {
    if (signal?.aborted) throw new DOMException('Save cancelled', 'AbortError')
    const body = new FormData()
    body.append('file', file)
    const response = await request('/api/upload', { method: 'POST', body, signal })
    const result = await response.json()
    if (!response.ok || typeof result.url !== 'string') {
      throw new Error(result.error?.message || result.error || 'Failed to upload image')
    }
    return result.url
  }

  const avatarUrl = draft.avatarFile ? await upload(draft.avatarFile) : draft.avatarUrl.trim()
  const bannerUrl = draft.bannerFile ? await upload(draft.bannerFile) : draft.bannerUrl.trim()
  if (signal?.aborted) throw new DOMException('Save cancelled', 'AbortError')
  const response = await request('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: draft.displayName.trim(), bio: draft.bio.trim(), avatarUrl, bannerUrl }),
    signal,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error?.message || 'Failed to save profile')
  return result
}

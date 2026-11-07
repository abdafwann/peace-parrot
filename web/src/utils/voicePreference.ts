type VoicePreference = { muted: boolean; deafened: boolean }
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>

export function loadVoicePreference(storage: StorageAccess, userId: string): VoicePreference {
  try {
    const value = JSON.parse(storage.getItem(`peaceparrot_voice_${userId}`) || '{}')
    return { muted: value.muted === true, deafened: value.deafened === true }
  } catch {
    return { muted: false, deafened: false }
  }
}

export function saveVoicePreference(storage: StorageAccess, userId: string, preference: VoicePreference): void {
  try {
    storage.setItem(`peaceparrot_voice_${userId}`, JSON.stringify(preference))
  } catch {
    // Storage may be unavailable; the active session still keeps its state.
  }
}

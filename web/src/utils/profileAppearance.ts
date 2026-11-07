export function isProfileGradient(value?: string): boolean {
  return !!value && value.startsWith('linear-gradient(')
}

export function selectedProfileGradient(value: string, hasFile: boolean, fallback: string): string | undefined {
  if (hasFile) return undefined
  if (!value) return fallback
  return isProfileGradient(value) ? value : undefined
}

export function profileAvatarAppearance(value?: string, name?: string): { background: string; initial: string } | undefined {
  if (!isProfileGradient(value)) return undefined
  return { background: value!, initial: (name?.trim()[0] || 'U').toUpperCase() }
}

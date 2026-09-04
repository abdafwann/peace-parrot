import { Role, useServerStore } from '../stores/serverStore'

interface RoleBadgeProps {
  role?: Role | { name?: string; color?: string; iconUrl?: string } | null
  roleName?: string
  showName?: boolean
  className?: string
}

export function RoleBadge({ role, roleName, showName = false, className = '' }: RoleBadgeProps) {
  const serverRoles = useServerStore((state) => state.roles)

  const effectiveRole =
    role ||
    (roleName ? serverRoles.find((r) => r.name.toLowerCase() === roleName.toLowerCase()) : null) ||
    (roleName?.toLowerCase() === 'admin'
      ? { name: 'Admin', color: '#f0b232', iconUrl: '👑' }
      : roleName?.toLowerCase() === 'moderator'
      ? { name: 'Moderator', color: '#23a559', iconUrl: '🛡️' }
      : null)

  if (!effectiveRole || !effectiveRole.iconUrl) return null

  const isImageIcon =
    effectiveRole.iconUrl.startsWith('http://') ||
    effectiveRole.iconUrl.startsWith('https://') ||
    effectiveRole.iconUrl.startsWith('data:') ||
    effectiveRole.iconUrl.startsWith('/')

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
      title={effectiveRole.name || 'Role'}
    >
      {isImageIcon ? (
        <img
          src={effectiveRole.iconUrl}
          alt={effectiveRole.name || 'Role'}
          className="w-3.5 h-3.5 rounded-sm object-contain shrink-0 shadow-sm"
        />
      ) : (
        <span className="text-xs shrink-0 select-none leading-none inline-block">{effectiveRole.iconUrl}</span>
      )}

      {showName && effectiveRole.name && (
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded shadow-sm ml-1"
          style={{
            color: effectiveRole.color || 'var(--color-brand)',
            backgroundColor: `${effectiveRole.color || '#5865F2'}18`,
          }}
        >
          {effectiveRole.name}
        </span>
      )}
    </span>
  )
}

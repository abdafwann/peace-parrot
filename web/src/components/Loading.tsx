import { Bird, Loader2 } from 'lucide-react'

interface LoadingProps {
  message?: string
  fullScreen?: boolean
}

export function Loading({ message = 'Loading...', fullScreen = false }: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <Bird size={48} className="text-[var(--color-brand)] animate-float" />
        <Loader2 size={24} className="absolute -bottom-1 -right-1 text-[var(--color-parrot-green)] animate-spin" />
      </div>
      <p className="text-[var(--color-text-secondary)]">{message}</p>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        {content}
      </div>
    )
  }

  return content
}

export function PageLoader() {
  return (
    <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="animate-fade-in">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-parrot-cyan))' }}>
          <Bird size={40} className="text-white" />
        </div>
      </div>
    </div>
  )
}

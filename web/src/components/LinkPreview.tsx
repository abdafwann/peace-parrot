import { useMemo } from 'react'
import { Link2, X } from 'lucide-react'

interface LinkPreviewData {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

interface LinkPreviewProps {
  url: string
  preview?: LinkPreviewData
  onDismiss?: () => void
}

// Extract URLs from text
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g
  return text.match(urlRegex) || []
}

// Simple URL parser to get domain
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

// Generate placeholder preview (until backend provides real data)
function getPlaceholderPreview(url: string): LinkPreviewData {
  const domain = getDomain(url)
  return {
    url,
    title: `Link to ${domain}`,
    siteName: domain,
  }
}

export function LinkPreviewCard({ url, preview, onDismiss }: LinkPreviewProps) {
  const data = preview || getPlaceholderPreview(url)

  return (
    <div
      className="mt-2 rounded-lg overflow-hidden max-w-md group"
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-default)',
      }}
    >
      {/* Link preview content */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3 hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        {/* Site name */}
        {data.siteName && (
          <p className="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
            <Link2 size={12} />
            {data.siteName}
          </p>
        )}

        {/* Title */}
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1 line-clamp-2">
          {data.title || url}
        </p>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
            {data.description}
          </p>
        )}

        {/* Image placeholder */}
        {data.image && (
          <div className="mt-2 rounded overflow-hidden">
            <img
              src={data.image}
              alt=""
              className="w-full h-32 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        )}
      </a>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onDismiss()
          }}
          className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-active)] transition-all"
          title="Remove preview"
        >
          <X size={14} className="text-[var(--color-text-muted)]" />
        </button>
      )}
    </div>
  )
}

interface LinkPreviewsProps {
  content: string
  onDismissUrl?: (url: string) => void
  dismissedUrls?: Set<string>
}

export function LinkPreviews({ content, onDismissUrl, dismissedUrls = new Set() }: LinkPreviewsProps) {
  const urls = useMemo(() => extractUrls(content), [content])

  if (urls.length === 0) return null

  return (
    <div className="space-y-2">
      {urls.map((url, index) => {
        if (dismissedUrls.has(url)) return null

        return (
          <div key={`${url}-${index}`} className="relative">
            <LinkPreviewCard
              url={url}
              onDismiss={onDismissUrl ? () => onDismissUrl(url) : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}

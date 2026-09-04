import { useEffect } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'

interface ImageLightboxModalProps {
  isOpen: boolean
  imageUrl: string
  filename?: string
  onClose: () => void
}

export function ImageLightboxModal({
  isOpen,
  imageUrl,
  filename = 'image.png',
  onClose,
}: ImageLightboxModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !imageUrl) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4 select-none"
      onClick={onClose}
    >
      {/* Top action toolbar */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={imageUrl}
          download={filename}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title="Download image"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Save</span>
        </a>

        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Open original"
        >
          <ExternalLink size={16} />
        </a>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close (ESC)"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main image */}
      <div
        className="max-w-5xl max-h-[85vh] flex items-center justify-center overflow-hidden rounded-2xl animate-fade-in-scale shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={filename}
          className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-2xl"
        />
      </div>

      {/* Footer filename */}
      {filename && (
        <div
          className="mt-3 text-xs text-white/60 font-medium truncate max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {filename}
        </div>
      )}
    </div>
  )
}

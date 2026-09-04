import { useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !loading) onConfirm()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel, onConfirm, loading])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-4">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-fade-in-scale"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isDanger && (
              <div className="w-8 h-8 rounded-xl bg-[#ed4245]/15 flex items-center justify-center text-[#ed4245]">
                <Trash2 size={18} />
              </div>
            )}
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
          </div>

          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message body */}
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{message}</p>

        {isDanger && (
          <div className="p-3 rounded-xl bg-[#ed4245]/10 border border-[#ed4245]/20 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-[#ed4245] shrink-0 mt-0.5" />
            <span className="text-xs text-red-300 font-medium leading-relaxed">
              This action is permanent and cannot be reversed.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all shadow-md cursor-pointer disabled:opacity-50 ${
              isDanger ? 'bg-[#ed4245] hover:bg-[#d83a3e]' : 'bg-[var(--color-brand)] hover:opacity-90'
            }`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

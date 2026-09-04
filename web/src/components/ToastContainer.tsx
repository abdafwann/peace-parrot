import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, Toast } from '../stores/toastStore'

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const isSuccess = toast.type === 'success'
  const isError = toast.type === 'error'
  const isWarning = toast.type === 'warning'
  const isInfo = toast.type === 'info'

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border
        transition-all duration-300 animate-fade-in-scale
        ${
          isSuccess
            ? 'bg-[#182a20]/95 border-[#23a559]/30 text-white'
            : isError
            ? 'bg-[#2b1719]/95 border-[#ed4245]/30 text-white'
            : isWarning
            ? 'bg-[#2b2517]/95 border-[#f0b232]/30 text-white'
            : 'bg-[var(--color-bg-elevated)]/95 border-[var(--color-border-default)] text-[var(--color-text-primary)]'
        }
      `}
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess && <CheckCircle2 size={18} className="text-[#23a559]" />}
        {isError && <AlertCircle size={18} className="text-[#ed4245]" />}
        {isWarning && <AlertTriangle size={18} className="text-[#f0b232]" />}
        {isInfo && <Info size={18} className="text-[var(--color-brand)]" />}
      </div>

      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5 opacity-90">
            {toast.title}
          </h4>
        )}
        <p className="text-xs font-medium leading-relaxed break-words">{toast.message}</p>
      </div>

      <button
        onClick={onClose}
        className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
      >
        <X size={14} />
      </button>
    </div>
  )
}

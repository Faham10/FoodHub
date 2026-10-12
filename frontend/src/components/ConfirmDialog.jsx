import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = true, busy = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-lift max-w-sm w-full p-6 relative">
        <button onClick={onCancel} className="absolute top-4 right-4 text-ink-950/40 hover:text-ink-950">
          <X size={18} />
        </button>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${danger ? 'bg-ember-100 text-ember-600' : 'bg-cream-200 text-ink-950'}`}>
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-ink-950/60 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={busy} className="btn-outline flex-1 py-2.5 disabled:cursor-wait disabled:opacity-60">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className={`flex-1 py-2.5 rounded-full font-semibold text-white disabled:cursor-wait disabled:opacity-60 ${danger ? 'bg-ember-500 hover:bg-ember-600' : 'bg-ink-950 hover:bg-ink-900'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

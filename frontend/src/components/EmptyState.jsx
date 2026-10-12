export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mb-4">
          <Icon className="text-ink-950/40" size={28} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink-950 mb-1">{title}</h3>
      {message && <p className="text-ink-950/60 max-w-sm mb-5">{message}</p>}
      {action}
    </div>
  )
}

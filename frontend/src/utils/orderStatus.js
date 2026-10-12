export function getOrderStatusTone(status) {
  if (status === 'Cancelled') return 'border-red-200 bg-red-50 text-red-700'
  if (status === 'Delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'Confirmed' || status === 'Preparing' || status === 'Out for Delivery') {
    return 'border-green-200 bg-green-50 text-green-700'
  }
  if (status === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-cream-200 bg-cream-50 text-ink-950/70'
}

export function getOrderStatusDot(status) {
  if (status === 'Cancelled') return 'bg-red-500'
  if (status === 'Delivered') return 'bg-emerald-500'
  if (status === 'Confirmed' || status === 'Preparing' || status === 'Out for Delivery') {
    return 'bg-green-500'
  }
  return 'bg-amber-500'
}

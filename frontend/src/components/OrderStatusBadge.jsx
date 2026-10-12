const STYLES = {
  Pending: 'bg-marigold-400/20 text-marigold-500',
  Confirmed: 'bg-blue-100 text-blue-700',
  Preparing: 'bg-purple-100 text-purple-700',
  'Out for Delivery': 'bg-ember-100 text-ember-600',
  Delivered: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
}

export function OrderStatusBadge({ status }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${STYLES[status] || 'bg-cream-200 text-ink-950'}`}>
      {status}
    </span>
  )
}

export default OrderStatusBadge

const PAYMENT_STYLES = {
  Pending: 'bg-marigold-400/20 text-marigold-500',
  Paid: 'bg-green-100 text-green-700',
  Failed: 'bg-red-100 text-red-700',
}

export function PaymentStatusBadge({ status }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${PAYMENT_STYLES[status] || 'bg-cream-200 text-ink-950'}`}>
      {status}
    </span>
  )
}

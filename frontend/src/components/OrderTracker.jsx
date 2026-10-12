import { Check, Circle, CircleDot, XCircle } from 'lucide-react'
import { getOrderStatusTone } from '../utils/orderStatus.js'

const STEPS = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered']

const STATUS_MESSAGES = {
  Pending: 'Your order is waiting for the restaurant to confirm.',
  Confirmed: 'The restaurant has confirmed your order.',
  Preparing: 'Fresh food is being prepared for you.',
  'Out for Delivery': 'Your order is on its way to you.',
  Delivered: 'Your order has been completed. Enjoy!',
}

export default function OrderTracker({ status }) {
  if (status === 'Cancelled') {
    return (
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <XCircle size={23} />
          </span>
          <div>
            <p className="font-bold text-red-800">Order cancelled</p>
            <p className="mt-0.5 text-sm text-red-700/75">This order will not be prepared or delivered.</p>
          </div>
        </div>
      </div>
    )
  }

  const currentIndex = Math.max(0, STEPS.indexOf(status))
  const progress = currentIndex / (STEPS.length - 1) * 100

  return (
    <div className="rounded-2xl border border-cream-200 bg-gradient-to-br from-white to-cream-50 p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink-950">Order progress</p>
          <p className="mt-0.5 text-xs text-ink-950/50">{STATUS_MESSAGES[status] || 'We are keeping you updated on your order.'}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${getOrderStatusTone(status)}`}>
          <span className={`h-2 w-2 rounded-full ${status === 'Delivered' ? 'bg-emerald-500' : status === 'Pending' ? 'bg-amber-500' : 'bg-green-500'}`} />
          {status}
        </span>
      </div>

      <div className="relative">
        <div className="absolute left-[10%] right-[10%] top-[13px] h-1 rounded-full bg-cream-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ember-400 to-ember-500 transition-[width] duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="relative grid grid-cols-5">
          {STEPS.map((step, index) => {
            const complete = index < currentIndex || status === 'Delivered'
            const current = index === currentIndex && status !== 'Delivered'
            return (
              <li key={step} className="flex min-w-0 flex-col items-center text-center">
                <span className={`z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                  complete
                    ? 'border-ember-500 bg-ember-500 text-white'
                    : current
                      ? 'border-ember-500 bg-white text-ember-600 shadow-[0_0_0_4px_rgba(232,73,29,0.12)]'
                      : 'border-cream-200 bg-white text-ink-950/25'
                }`}>
                  {complete ? <Check size={14} strokeWidth={3} /> : current ? <CircleDot size={15} /> : <Circle size={13} />}
                </span>
                <span className={`mt-2 max-w-full px-0.5 text-[9px] font-semibold leading-tight sm:text-[10px] ${
                  complete || current ? 'text-ink-950' : 'text-ink-950/40'
                }`}>
                  {step}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Printer,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import api from '../services/api.js'
import { formatPKR, formatDateTime, formatOrderNumber } from '../utils/format.js'
import { getOrderStatusDot, getOrderStatusTone } from '../utils/orderStatus.js'
import PageLoader from '../components/PageLoader.jsx'
import OrderTracker from '../components/OrderTracker.jsx'
import BrandLogo from '../components/BrandLogo.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  clearActiveGuestOrderToken,
  getActiveGuestOrderToken,
  notifyGuestOrderStatusChange,
  setActiveGuestOrderToken,
} from '../utils/guestOrderTracking.js'
import { formatBranchName } from '../utils/branch.js'

export default function OrderConfirmation() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const trackingToken = searchParams.get('token')
  const { showToast } = useToast()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const endpoint = trackingToken ? `/orders/track/${trackingToken}` : `/orders/${id}`
    let active = true
    let hasOrder = false
    let stopPolling = false
    let requestInFlight = false
    let timeout

    const refreshOrder = async () => {
      if (!active || stopPolling || requestInFlight || document.visibilityState === 'hidden') return
      requestInFlight = true
      try {
        const response = await api.get(endpoint)
        if (!active) return
        hasOrder = true
        if (trackingToken) notifyGuestOrderStatusChange(trackingToken, response.data, showToast)
        setOrder(response.data)
        setLoadError('')
        if (trackingToken && getActiveGuestOrderToken() !== trackingToken) {
          setActiveGuestOrderToken(trackingToken, response.data.order_status)
        }
      } catch (err) {
        console.error('Could not refresh the order status', err)
        stopPolling = [401, 404].includes(err.response?.status)
        if (
          active
          && err.response?.status === 404
          && trackingToken
          && getActiveGuestOrderToken() === trackingToken
        ) {
          clearActiveGuestOrderToken()
        }
        if (active) {
          setLoadError(
            err.response?.status === 404
              ? 'This order tracking link is no longer valid.'
              : err.response?.status === 401
                ? 'A private guest order tracking link is required.'
              : 'Order status could not be refreshed. We will try again shortly.',
          )
          if (stopPolling || !hasOrder) setOrder(null)
        }
      } finally {
        requestInFlight = false
        if (active) {
          setLoading(false)
          if (!stopPolling && document.visibilityState !== 'hidden') {
            timeout = setTimeout(refreshOrder, 5000)
          }
        }
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'hidden') return
      clearTimeout(timeout)
      refreshOrder()
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    setLoading(true)
    refreshOrder()
    return () => {
      active = false
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [id, showToast, trackingToken, retryCount])

  if (loading) return <PageLoader />
  if (!order) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-semibold">We couldn't load your order.</h1>
        <p role="alert" className="mt-2 text-ink-950/60">{loadError || 'Use the order tracking link from your checkout confirmation.'}</p>
        {trackingToken && (
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="btn-outline mt-5">
            Try Again
          </button>
        )}
        <Link to="/menu" className="btn-primary mt-5">Browse Menu</Link>
      </div>
    )
  }

  const locationLabel = order.order_type === 'Delivery'
    ? 'Delivery Address'
    : order.order_type === 'Dine-In' ? 'Table / Seating' : 'Pick-Up Location'

  return (
    <div className="container-page mx-auto max-w-2xl py-8 sm:py-12">
      <div className="mb-5 text-center">
        <BrandLogo className="mx-auto mb-3 h-16" />
        <div className="rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 px-5 py-5 text-white shadow-lg shadow-green-700/15">
          <h1 className="text-2xl font-bold">Thank You!</h1>
          <p className="mt-1 text-sm text-white/90">Your order has been placed successfully.</p>
        </div>
      </div>

      <section className="card mb-4 p-5 sm:p-6" aria-label="Order status">
        <div className="flex flex-col gap-3 border-b border-cream-200 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="w-full sm:w-auto">
            <span className="text-xs text-ink-950/55">Order Number</span>
            <p className="font-bold">#{formatOrderNumber(order)}</p>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end sm:text-right">
            <span className="text-xs text-ink-950/55">Status</span>
            <p className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold sm:mt-1 ${getOrderStatusTone(order.order_status)}`}>
              <span className={`h-2 w-2 rounded-full ${getOrderStatusDot(order.order_status)}`} />
              {order.order_status}
            </p>
          </div>
        </div>
        <div className="py-4 text-center">
          <h2 className="font-semibold">Need Support?</h2>
          <p className="mt-1 text-sm text-ink-950/60">Keep your order number handy when contacting the branch.</p>
          <p className="mt-1 text-sm font-semibold">{formatBranchName(order.branch_name)}</p>
        </div>
        <div className="border-t border-cream-200 pt-5">
          <OrderTracker status={order.order_status} />
        </div>
        {loadError && <p role="status" className="mt-3 text-sm text-ember-700">{loadError}</p>}
      </section>

      <section className="card mb-4 overflow-hidden">
        <h2 className="flex items-center gap-2 bg-cream-100 px-5 py-4 font-semibold">
          <UserRound size={18} /> Customer Information
        </h2>
        <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-950/50">Customer Name</dt>
            <dd className="mt-1 text-sm font-semibold">{order.customer_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-950/50">Mobile Number</dt>
            <dd className="mt-1 text-sm font-semibold">{order.phone}</dd>
          </div>
        </dl>
      </section>

      <section className="card mb-4 overflow-hidden">
        <h2 className="flex items-center gap-2 bg-cream-100 px-5 py-4 font-semibold">
          <MapPin size={18} /> {order.order_type} Information
        </h2>
        <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-950/50">{locationLabel}</dt>
            <dd className="mt-1 text-sm font-semibold">{order.table_info || order.delivery_address || formatBranchName(order.branch_name)}</dd>
            {order.delivery_area && <dd className="mt-1 text-xs text-ink-950/55">Area: {order.delivery_area}</dd>}
          </div>
          <div>
            <dt className="text-xs text-ink-950/50">Branch</dt>
            <dd className="mt-1 text-sm font-semibold">{formatBranchName(order.branch_name)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-950/50">Order Type</dt>
            <dd className="mt-1 text-sm font-semibold">{order.order_type}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-ink-950/50"><CalendarDays size={13} /> Order Date</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDateTime(order.created_at)}</dd>
          </div>
          {order.instructions && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink-950/50">Instructions</dt>
              <dd className="mt-1 text-sm font-semibold">{order.instructions}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card mb-4 overflow-hidden">
        <h2 className="flex items-center gap-2 bg-cream-100 px-5 py-4 font-semibold">
          <ShoppingBag size={18} /> Products
        </h2>
        <div className="divide-y divide-cream-200 px-5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm">
              <div>
                <p className="font-semibold">{item.product_name}</p>
                <p className="mt-1 text-xs text-ink-950/50">Qty: {item.quantity}</p>
              </div>
              <span className="shrink-0 font-semibold">{formatPKR(item.line_total)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-6 overflow-hidden">
        <h2 className="flex items-center justify-between gap-3 bg-cream-100 px-5 py-4 font-semibold">
          <span className="flex items-center gap-2"><Banknote size={18} /> Payment</span>
          <span className="rounded-full bg-ink-950 px-3 py-1 text-xs text-white">{order.payment_method}</span>
        </h2>
        <div className="space-y-3 p-5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-ink-950/60">Subtotal</span><span>{formatPKR(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between gap-3 text-green-700">
              <span>Discount{order.promotion_name ? ` · ${order.promotion_name}` : ''}{order.coupon_code ? ` (${order.coupon_code})` : ''}</span><span>-{formatPKR(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-ink-950/60">Delivery Fee</span>
            <span>{order.delivery_fee > 0 ? formatPKR(order.delivery_fee) : 'Free'}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-cream-200 pt-3 text-base font-bold">
            <span>Grand Total</span><span>{formatPKR(order.total)}</span>
          </div>
          <p className="text-xs text-ink-950/50">Payment status: {order.payment_status}</p>
        </div>
      </section>

      <div className="no-print flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => window.print()} className="btn-outline flex-1 justify-center py-3">
          <Printer size={16} /> Print Receipt
        </button>
        <Link to="/menu" className="btn-primary flex-1 justify-center py-3">
          <ShoppingBag size={16} /> Place Another Order
        </Link>
      </div>
    </div>
  )
}

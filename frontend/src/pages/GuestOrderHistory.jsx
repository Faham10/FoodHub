import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, Clock3, History, MapPin, RefreshCw, ShoppingBag } from 'lucide-react'
import api from '../services/api.js'
import PageLoader from '../components/PageLoader.jsx'
import { formatDateTime, formatOrderNumber, formatPKR } from '../utils/format.js'
import { getOrderStatusDot, getOrderStatusTone } from '../utils/orderStatus.js'
import { formatBranchName } from '../utils/branch.js'
import { useToast } from '../context/ToastContext.jsx'
import { getGuestOrderTokens, notifyGuestOrderStatusChange, removeGuestOrderToken } from '../utils/guestOrderTracking.js'

export default function GuestOrderHistory() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  const loadOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const tokens = getGuestOrderTokens()
    if (tokens.length === 0) {
      setOrders([])
      setLoadError('')
      setLoading(false)
      return
    }

    setLoadError('')
    const results = await Promise.allSettled(
      tokens.map((token) => api.get(`/orders/track/${encodeURIComponent(token)}`)),
    )
    const loadedOrders = []
    let failedRequests = 0

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        notifyGuestOrderStatusChange(tokens[index], result.value.data, showToast)
        loadedOrders.push({
          ...result.value.data,
          tracking_token: tokens[index],
        })
      } else if (result.reason.response?.status === 404) {
        removeGuestOrderToken(tokens[index])
      } else {
        failedRequests += 1
        console.error('Could not load a guest order from history', result.reason)
      }
    })

    setOrders(loadedOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    if (failedRequests > 0) {
      setLoadError('Some orders could not be loaded. Check your connection and try again.')
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    let active = true
    let requestInFlight = false
    let timeout

    const refreshOrders = async (showLoading = false) => {
      if (!active || requestInFlight || document.visibilityState === 'hidden') return
      requestInFlight = true
      try {
        await loadOrders(showLoading)
      } finally {
        requestInFlight = false
        if (active && document.visibilityState !== 'hidden') {
          timeout = setTimeout(() => refreshOrders(false), 5000)
        }
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'hidden') return
      clearTimeout(timeout)
      refreshOrders(false)
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    refreshOrders(true)
    return () => {
      active = false
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [loadOrders, retryCount])

  if (loading) return <PageLoader />

  return (
    <div className="container-page mx-auto max-w-4xl py-10 sm:py-14">
      <div className="mb-8 rounded-3xl bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 p-6 text-white shadow-lift sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ember-300">Your Bismillah Food order history</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your Orders</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
              Check previous orders from this browser, see their branch and status, or open a receipt.
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-ember-300 ring-1 ring-white/10 sm:h-14 sm:w-14">
            <History size={25} />
          </span>
        </div>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
          <ShoppingBag size={14} />
          {orders.length} {orders.length === 1 ? 'order' : 'orders'} saved
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="inline-flex items-center gap-1.5 font-semibold"
          >
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card px-6 py-12 text-center sm:py-16">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ember-50 text-ember-600">
            <ShoppingBag size={26} />
          </span>
          <h2 className="mt-4 text-xl font-bold">No previous orders here yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-950/55">
            Orders placed from this browser will appear here automatically. Guest history is private to this browser.
          </p>
          <Link to="/menu" className="btn-primary mt-6">Explore the Menu</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderUrl = `/order-confirmation/${order.id}?token=${encodeURIComponent(order.tracking_token)}`
            const itemCount = order.items.reduce((total, item) => total + item.quantity, 0)
            return (
              <article key={order.tracking_token} className="card overflow-hidden transition-shadow hover:shadow-lift">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-bold">Order #{formatOrderNumber(order)}</h2>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${getOrderStatusTone(order.order_status)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getOrderStatusDot(order.order_status)}`} />
                        {order.order_status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-950/55">
                      <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{formatBranchName(order.branch_name)}</span>
                      <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{order.order_type}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{formatDateTime(order.created_at)}</span>
                    </div>
                    <p className="mt-3 truncate text-sm text-ink-950/65">
                      {order.items.map((item) => `${item.product_name} × ${item.quantity}`).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-cream-200 pt-4 sm:min-w-40 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-ink-950/45">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
                      <p className="mt-0.5 font-bold">{formatPKR(order.total)}</p>
                    </div>
                    <Link to={orderUrl} className="inline-flex items-center gap-1.5 rounded-xl bg-ember-50 px-3.5 py-2.5 text-sm font-bold text-ember-700 transition hover:bg-ember-100">
                      View receipt <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

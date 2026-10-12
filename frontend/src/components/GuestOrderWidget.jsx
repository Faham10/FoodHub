import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronDown, Eye, PackageCheck, RefreshCw } from 'lucide-react'
import api from '../services/api.js'
import { formatOrderNumber } from '../utils/format.js'
import { useToast } from '../context/ToastContext.jsx'
import { getOrderStatusDot, getOrderStatusTone } from '../utils/orderStatus.js'
import { formatBranchName } from '../utils/branch.js'
import {
  clearActiveGuestOrderToken,
  getActiveGuestOrderToken,
  notifyGuestOrderStatusChange,
  subscribeToActiveGuestOrder,
} from '../utils/guestOrderTracking.js'

export default function GuestOrderWidget() {
  const location = useLocation()
  const { showToast } = useToast()
  const widgetRef = useRef(null)
  const [trackingToken, setTrackingToken] = useState(() => getActiveGuestOrderToken())
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const syncTrackingToken = useCallback(() => {
    setTrackingToken(getActiveGuestOrderToken())
  }, [])

  useEffect(() => subscribeToActiveGuestOrder(syncTrackingToken), [syncTrackingToken])

  useEffect(() => {
    if (!isOpen) return undefined

    const closeOnOutsideClick = (event) => {
      if (!widgetRef.current?.contains(event.target)) setIsOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (!trackingToken || location.pathname.startsWith('/order-confirmation/')) {
      setOrder(null)
      setError('')
      return undefined
    }

    setOrder(null)
    setError('')
    let active = true
    let requestInFlight = false
    let timeout
    const refreshOrder = async () => {
      if (!active || requestInFlight || document.visibilityState === 'hidden') return
      requestInFlight = true
      try {
        const response = await api.get(`/orders/track/${encodeURIComponent(trackingToken)}`)
        if (active) {
          notifyGuestOrderStatusChange(trackingToken, response.data, showToast)
          setOrder(response.data)
          setError('')
        }
      } catch (requestError) {
        if (
          active
          && requestError.response?.status === 404
          && getActiveGuestOrderToken() === trackingToken
        ) {
          clearActiveGuestOrderToken()
        } else if (active) {
          console.error('Could not refresh the current guest order', requestError)
          setError('Order status could not be refreshed.')
        }
      } finally {
        requestInFlight = false
        if (active && document.visibilityState !== 'hidden') {
          timeout = setTimeout(refreshOrder, 5000)
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
    refreshOrder()
    return () => {
      active = false
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [location.pathname, showToast, trackingToken, retryCount])

  if (
    !trackingToken
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/order-confirmation/')
  ) return null

  const orderUrl = order
    ? `/order-confirmation/${order.id}?token=${encodeURIComponent(trackingToken)}`
    : null
  const status = order?.order_status || 'Checking'
  const isCancelled = order?.order_status === 'Cancelled'

  return (
    <div ref={widgetRef} className="relative">
      <button
        type="button"
        aria-label={order ? `Track current order, status ${order.order_status}` : 'Track your current order'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((open) => !open)}
        className={`group relative inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full border px-0 text-sm font-semibold transition-all duration-200 sm:h-10 sm:w-auto sm:justify-start sm:px-2.5 ${
          isOpen ? 'border-ember-200 bg-ember-50 text-ember-700 shadow-sm' : 'border-transparent text-ink-950 hover:border-cream-200 hover:bg-cream-50'
        }`}
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-ember-50 text-ember-600 transition-colors group-hover:bg-ember-100 sm:h-8 sm:w-8">
          <PackageCheck size={18} />
          <span className={`absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white ${getOrderStatusDot(order?.order_status)}`} />
        </span>
        <span className="hidden max-w-28 sm:block">
          <span className="block whitespace-nowrap text-[10px] font-semibold leading-tight text-ink-950/50">Current order</span>
          <span className="block max-w-28 truncate text-xs font-bold leading-tight">{status}</span>
        </span>
        <ChevronDown size={15} className={`hidden text-ink-950/40 transition-transform sm:block ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <section
          role="dialog"
          aria-label="Your current order"
          aria-live="polite"
          className="fixed right-3 top-[4.75rem] z-[70] w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_20px_60px_rgba(26,19,16,0.18)] ring-1 ring-ink-950/5 sm:absolute sm:right-0 sm:top-full sm:mt-3"
        >
          <div className="bg-gradient-to-br from-ink-950 to-ink-800 px-5 pb-5 pt-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">Bismillah Food updates</p>
                <h2 className="mt-1 text-lg font-bold">Your current order</h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-ember-300 ring-1 ring-white/10">
                <PackageCheck size={21} />
              </span>
            </div>
            {order && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-white/55">ORDER NUMBER</p>
                  <p className="mt-0.5 truncate font-semibold">#{formatOrderNumber(order)}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold ${getOrderStatusTone(status)}`}>
                  {!isCancelled && <Check size={13} strokeWidth={3} />}
                  {status}
                </span>
              </div>
            )}
          </div>
          <div className="p-4">
            {order ? (
              <>
                <p className="mb-3 truncate text-sm text-ink-950/55">{formatBranchName(order.branch_name)} <span className="px-1">·</span> {order.order_type}</p>
                {error && <p role="status" className="mb-3 text-xs text-ember-700">{error}</p>}
                {orderUrl && (
                  <Link
                    to={orderUrl}
                    onClick={() => setIsOpen(false)}
                    className="group flex w-full items-center justify-between rounded-xl bg-ember-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-ember-500/20 transition hover:bg-ember-600"
                  >
                    <span className="flex items-center gap-2"><Eye size={17} /> Track this order</span>
                    <ArrowUpRight size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                )}
              </>
            ) : error ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <p role="alert" className="text-ink-950/70">{error}</p>
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="flex shrink-0 items-center gap-1.5 font-semibold text-ember-600"
                >
                  <RefreshCw size={15} /> Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-1">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-ember-100 border-t-ember-500" />
                <p className="text-sm text-ink-950/60">Checking your latest order...</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ShoppingBag } from 'lucide-react'
import api from '../../services/api.js'
import { formatPKR, formatDateTime, formatOrderNumber } from '../../utils/format.js'
import PageLoader from '../../components/PageLoader.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import OrderStatusBadge, { PaymentStatusBadge } from '../../components/OrderStatusBadge.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useAutoRefresh } from '../../hooks/useAutoRefresh.js'

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled']
const ORDER_TYPES = [
  { value: '', label: 'All Orders' },
  { value: 'Delivery', label: 'Delivery Orders' },
  { value: 'Pick-Up', label: 'Pick-Up Orders' },
  { value: 'Dine-In', label: 'Dine-In Orders' },
]

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState('')
  const latestRequest = useRef(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState(() => {
    const requestedType = searchParams.get('order_type') || ''
    return ORDER_TYPES.some((type) => type.value === requestedType) ? requestedType : ''
  })
  const debouncedSearch = useDebounce(search, 400)

  useEffect(() => {
    const requestedType = searchParams.get('order_type') || ''
    setTypeFilter(ORDER_TYPES.some((type) => type.value === requestedType) ? requestedType : '')
  }, [searchParams])

  const selectOrderType = (value) => {
    setTypeFilter(value)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set('order_type', value)
      else next.delete('order_type')
      return next
    }, { replace: true })
  }

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current
    const params = {}
    if (debouncedSearch) params.search = debouncedSearch
    if (statusFilter) params.status = statusFilter
    if (typeFilter) params.order_type = typeFilter
    try {
      const res = await api.get('/admin/orders', { params })
      if (requestId === latestRequest.current) {
        setOrders(res.data)
        setRefreshError('')
      }
    } catch {
      if (requestId === latestRequest.current) {
        setRefreshError('Orders could not be refreshed. Retrying automatically...')
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [debouncedSearch, statusFilter, typeFilter])

  useAutoRefresh(load)

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Orders</h1>
      {refreshError && <p role="status" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{refreshError}</p>}

      <div className="mb-5 flex flex-wrap gap-2">
        {ORDER_TYPES.map(({ value, label }) => (
          <button
            key={value || 'all'}
            type="button"
            aria-pressed={typeFilter === value}
            onClick={() => selectOrderType(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${typeFilter === value ? 'bg-ink-950 text-white' : 'bg-white text-ink-950/60 hover:bg-cream-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/35" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer or phone..." className="input-field !pl-12 !py-2.5 bg-white" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field !py-2.5 max-w-[200px] bg-white">
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <PageLoader />
      ) : orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders found" message="Orders will appear here once customers start placing them." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-ink-950/45 border-b border-cream-200">
                <th className="p-4 font-semibold">Order ID</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold">Phone</th>
                <th className="p-4 font-semibold">Total</th>
                <th className="p-4 font-semibold">Payment</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-cream-50">
                  <td className="p-4">
                    <Link to={`/admin/orders/${o.id}`} className="font-semibold text-ember-600 hover:underline">#{formatOrderNumber(o)}</Link>
                  </td>
                  <td className="p-4">{o.order_type}</td>
                  <td className="p-4">{o.customer_name}</td>
                  <td className="p-4 text-ink-950/60">{o.phone}</td>
                  <td className="p-4 font-semibold">{formatPKR(o.total)}</td>
                  <td className="p-4"><PaymentStatusBadge status={o.payment_status} /></td>
                  <td className="p-4"><OrderStatusBadge status={o.order_status} /></td>
                  <td className="p-4 text-ink-950/50 whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

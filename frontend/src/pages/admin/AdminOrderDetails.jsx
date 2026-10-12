import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import api from '../../services/api.js'
import { formatPKR, formatDateTime, formatOrderNumber } from '../../utils/format.js'
import { formatBranchName } from '../../utils/branch.js'
import { useToast } from '../../context/ToastContext.jsx'
import PageLoader from '../../components/PageLoader.jsx'
import OrderTracker from '../../components/OrderTracker.jsx'

const VALID_TRANSITIONS = {
  Pending: ['Pending', 'Confirmed', 'Cancelled'],
  Confirmed: ['Confirmed', 'Preparing', 'Cancelled'],
  Preparing: ['Preparing', 'Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Out for Delivery', 'Delivered', 'Cancelled'],
  Delivered: ['Delivered'],
  Cancelled: ['Cancelled'],
}

const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed']

export default function AdminOrderDetails() {
  const { id } = useParams()
  const { showToast } = useToast()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const load = () => {
    api.get(`/admin/orders/${id}`).then((res) => setOrder(res.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [id])

  const updateOrder = async (payload) => {
    setUpdating(true)
    try {
      const res = await api.put(`/admin/orders/${id}`, payload)
      setOrder(res.data)
      showToast('Order updated successfully')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update order', 'error')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <PageLoader />
  if (!order) return null

  const availableTransitions = VALID_TRANSITIONS[order.order_status] || [order.order_status]

  return (
    <div className="max-w-4xl">
      <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-950/60 hover:text-ember-600 mb-6">
        <ChevronLeft size={16} /> Back to Orders
      </Link>

      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Order #{formatOrderNumber(order)}</h1>
          <p className="text-sm text-ink-950/50">{order.order_type} · {formatBranchName(order.branch_name)} · {formatDateTime(order.created_at)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold mb-5">Order Tracking</h2>
            <OrderTracker status={order.order_status} />
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-4">Items</h2>
            <div className="divide-y divide-cream-200">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 flex justify-between text-sm">
                  <div>
                    <div>{item.product_name}</div>
                    <div className="text-ink-950/45 text-xs">{formatPKR(item.unit_price)} × {item.quantity}</div>
                  </div>
                  <span className="font-semibold">{formatPKR(item.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-cream-200 mt-4 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-950/60">Subtotal</span><span>{formatPKR(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-ink-950/60">Delivery Fee</span><span>{order.delivery_fee > 0 ? formatPKR(order.delivery_fee) : 'Free'}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount{order.promotion_name ? ` · ${order.promotion_name}` : ''}{order.coupon_code ? ` (${order.coupon_code})` : ''}</span><span>-{formatPKR(order.discount)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span>{formatPKR(order.total)}</span></div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-2">Customer & Delivery Info</h2>
            <p className="text-sm text-ink-950/70">{order.customer_name} · {order.phone}</p>
            {order.delivery_address && <p className="text-sm text-ink-950/70">{order.delivery_address}</p>}
            {order.delivery_area && <p className="text-sm text-ink-950/70">Area: {order.delivery_area}</p>}
            {order.table_info && <p className="text-sm text-ink-950/70">Table: {order.table_info}</p>}
            {order.instructions && <p className="mt-2 text-sm text-ink-950/70">Instructions: {order.instructions}</p>}
          </div>
        </div>

        <div className="card p-6 space-y-6">
          <div>
            <label className="label-field">Order Status</label>
            <select disabled={updating} value={order.order_status} onChange={(e) => updateOrder({ order_status: e.target.value })} className="input-field">
              {availableTransitions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Payment Method</label>
            <input disabled value={order.payment_method} className="input-field bg-cream-100 text-ink-950/50" />
          </div>
          <div>
            <label className="label-field">Payment Status</label>
            <select disabled={updating} value={order.payment_status} onChange={(e) => updateOrder({ payment_status: e.target.value })} className="input-field">
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <p className="text-xs text-ink-950/40">Changes are saved instantly and persist after refresh or re-login.</p>
        </div>
      </div>
    </div>
  )
}
